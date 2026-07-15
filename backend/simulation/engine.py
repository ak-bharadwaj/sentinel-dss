from typing import Any, Dict, List, Optional, Tuple, Set, Union, cast
import networkx as nx
import math
import time
import json
from datetime import datetime
from backend.world_model.world_state import world_state
from backend.agents.scout import ScoutAgent
from backend.agents.rescue import RescueAgent
from backend.agents.base_agent import AgentStatus
from backend.agents.coordinator import Coordinator
from backend.world_model.global_memory import gmm
from backend.belief.bayesian_update import apply_scout_observation
from backend.belief.knowledge_decay import decay_confidence
from backend.simulation.corruption import corrupt_belief_graph
from backend.config import settings

def is_in_blackout_zone(lat: Optional[float], lon: Optional[float], zones: List[Dict[str, float]]) -> bool:
    if lat is None or lon is None:
        return False
    for zone in zones:
        d_lat = (lat - zone['lat']) * 111000
        d_lon = (lon - zone['lon']) * 111000 * math.cos(math.radians(zone['lat']))
        dist = math.hypot(d_lat, d_lon)
        if dist <= zone['radius_m']:
            return True
    return False

class SimulationEngine:
    def __init__(self) -> None:
        self.simulation_time: int = 0
        self.max_time: int = 60  # Maximum simulation steps (60 minutes)
        self.agents: Dict[str, Any] = {}  # id -> Agent object
        self.coordinator: Optional[Coordinator] = None
        self.active_baseline: str = "AMIS-RU"  # "AMIS-RU", "BASELINE-A", "BASELINE-B"
        self.disaster_type: str = "FLOOD"
        self.tide_phase: str = "LOW TIDE"
        self.new_events: List[str] = []
        self.blackout_zones: List[Dict[str, float]] = []
        self.replanning_required: bool = False
        self.replanning_reason: Optional[str] = None
        self.last_telemetry: Dict[str, Any] = {
            "physics_ms": 0.0,
            "belief_ms": 0.0,
            "tensor_ms": 0.0,
            "decision_ms": 0.0,
            "allocation_ms": 0.0,
            "routing_ms": 0.0,
            "scout_missions": 0,
            "rescue_missions": 0,
            "completed_rescues": 0,
            "routes_replanned": 0,
            "avg_confidence": 0.0,
            "avg_danger": 0.0,
            "roads_closed": 0
        }
        
        # Metrics tracking
        self.total_survivors_saved: int = 0
        self.initial_total_population: int = 0
        self.weather: Any = None
        self.world_version: int = 0
        self.history: List[Dict[str, Any]] = []  # time-series logs
        
        # Strategic and Civilian Evacuation settings (Phase 2)
        self.broadcast_mode: str = "SHELTER_IN_PLACE"
        self.paused_for_decision: bool = False
        self.active_decision: Optional[Dict[str, Any]] = None
        self.last_blocked_count: int = 0
        self.triggered_havens: set = set()
        self.safe_route_mode: bool = False
        self.scout_clear_mode: bool = False
        self.civilian_stuck_timers: Dict[str, int] = {}
        
        # Phase 4: Resource Pool
        from backend.simulation.resources import ResourcePool
        self.resource_pool = ResourcePool()

    def add_event(self, event: str) -> None:
        self.new_events.append(event)
        
    def add_xai_event(self, action: str, reason: Optional[str] = None, requires_approval: bool = False, confidence: float = 1.0, recommendation: Optional[str] = None) -> None:
        now_str = datetime.now().strftime("%H:%M:%S")
        evt = {
            "type": "xai",
            "time": now_str,
            "action": action,
            "reason": reason,
            "requires_approval": requires_approval,
            "confidence": confidence,
            "recommendation": recommendation
        }
        self.new_events.append(json.dumps(evt))

    def pop_new_events(self) -> List[str]:
        events = list(self.new_events)
        self.new_events = []
        return events

    def trigger_global_rtb(self):
        """Forces all agents to abort current missions and path to nearest safe zone."""
        safe_nodes = [
            n for n, data in world_state.belief.nodes(data=True) 
            if data.get('node_type') in ("SHELTER", "HOSPITAL")
        ]
        if not safe_nodes:
            self.add_event("[COMMAND] GLOBAL RTB ABORTED: No safe havens available!")
            return False
            
        count = 0
        for agent in self.agents.values():
            if agent.status == AgentStatus.IDLE:
                continue
                
            # Find closest safe node
            try:
                shortest_path = None
                shortest_len = float('inf')
                for safe_node in safe_nodes:
                    if nx.has_path(world_state.belief, agent.current_node, safe_node):
                        length = nx.shortest_path_length(world_state.belief, agent.current_node, safe_node, weight=f'cost_{agent.vehicle_type}')
                        if length < shortest_len:
                            shortest_len = length
                            shortest_path = nx.shortest_path(world_state.belief, agent.current_node, safe_node, weight=f'cost_{agent.vehicle_type}')
                
                if shortest_path:
                    agent.route = shortest_path[1:] # strip current node
                    agent.progress_on_edge = 0.0
                    agent.next_node = None
                    agent.full_planned_route = list(shortest_path)
                    
                    if agent.route:
                        agent.target_node = agent.route[-1]
                    else:
                        agent.target_node = agent.current_node

                    agent.status = AgentStatus.RETURNING
                    count += 1
            except nx.NetworkXNoPath:
                pass
                
        self.add_event(f"[COMMAND] 🚨 GLOBAL RTB TRIGGERED! {count} agents retreating to safe zones.")
        return True

    def setup_simulation(self, baseline_type: str = "AMIS-RU", corruption_level: float = 0.6, osm_path=None, center_lat=37.7749, center_lon=-122.4194, num_scouts: int = 3, num_rescues: int = 3, disaster_type: str = "FLOOD", num_zodiacs: int = 0, num_helicopters: int = 0, num_trucks: int = 0, num_cars: int = 0):
        """Resets the simulation, builds graphs, and creates scouts and rescue teams."""
        self.simulation_time = 0
        self.total_survivors_saved = 0
        self.history = []
        self.active_baseline = baseline_type
        self.disaster_type = disaster_type
        self.center_lat = center_lat
        self.center_lon = center_lon
        
        # Reset Phase 2 Strategic variables
        self.broadcast_mode = "SHELTER_IN_PLACE"
        self.paused_for_decision = False
        self.active_decision = None
        self.last_blocked_count = 0
        self.triggered_havens = set()
        self.safe_route_mode = False
        self.scout_clear_mode = False
        self.civilian_stuck_timers = {}
        
        self.resource_pool.reset()
        
        # 2 radio blackout zones
        self.blackout_zones = [
            {"lat": center_lat + 0.006, "lon": center_lon - 0.006, "radius_m": 600},
            {"lat": center_lat - 0.007, "lon": center_lon + 0.007, "radius_m": 600}
        ]
        
        # 1. Reset world state and save initial belief in one fast transaction
        world_state.initialize(osm_path, center_lat=center_lat, center_lon=center_lon, corruption_level=corruption_level)
        
        # Initialize visited flags, default resource values, and occupants for all nodes
        for n_id in world_state.belief.nodes:
            world_state.belief.nodes[n_id]['visited_at_least_once'] = False
            world_state.belief.nodes[n_id]['occupants'] = 0
            world_state.ground_truth.nodes[n_id]['occupants'] = 0
            
            node_type = world_state.belief.nodes[n_id].get('node_type')
            if node_type in ("SHELTER", "HOSPITAL"):
                resources = {
                    "food": 100.0,
                    "water": 100.0,
                    "medicine": 100.0,
                    "fuel": 100.0
                }
                world_state.belief.nodes[n_id]['resources'] = resources.copy()
                world_state.ground_truth.nodes[n_id]['resources'] = resources.copy()
        
        # Calculate initial population
        self.initial_total_population = sum(
            data.get('population', 0) 
            for n, data in world_state.ground_truth.nodes(data=True)
        )
        
        # Find a central node as base (prefer a HOSPITAL or SHELTER in the largest connected component)
        components = sorted(nx.connected_components(world_state.ground_truth), key=len, reverse=True)
        largest_comp = list(components[0]) if components else list(world_state.ground_truth.nodes)
        
        base_candidates = [
            n for n in largest_comp
            if world_state.ground_truth.nodes[n].get('node_type') in ("HOSPITAL", "SHELTER")
        ]
        if base_candidates:
            center_node = base_candidates[0]
        else:
            degrees = dict(world_state.ground_truth.degree(largest_comp))
            center_node = max(degrees, key=degrees.get) if degrees else largest_comp[0]
            
        self.coordinator = Coordinator(base_node=center_node)
        
        # ── Geographically distribute agent start positions across the full graph ──
        # [REMOVED FOR MANUAL DEPLOYMENT]
        self.agents = {}

        # Precompute edge costs for initial routing
        from backend.routing.confidence_dijkstra import calculate_edge_cost
        for u, v, d in world_state.belief.edges(data=True):
            d['cost_STANDARD_CAR'] = calculate_edge_cost(world_state.belief, u, v, d, 'STANDARD_CAR', disaster_type=self.disaster_type)
            d['cost_ZODIAC_BOAT'] = calculate_edge_cost(world_state.belief, u, v, d, 'ZODIAC_BOAT', disaster_type=self.disaster_type)
            d['cost_HIGH_WATER_TRUCK'] = calculate_edge_cost(world_state.belief, u, v, d, 'HIGH_WATER_TRUCK', disaster_type=self.disaster_type)
            d['cost_HELICOPTER'] = calculate_edge_cost(world_state.belief, u, v, d, 'HELICOPTER', disaster_type=self.disaster_type)
            d['cost_SCOUT_CAR'] = calculate_edge_cost(world_state.belief, u, v, d, 'SCOUT_CAR', disaster_type=self.disaster_type)
            
        # Compile vector graph to matrix
        gmm.compile_graph_to_tensor(world_state.belief)

        # Run initial coordinator assignment for scouts and rescues so paths are visible at step 0
        idle_scouts = [a for a in self.agents.values() if a.agent_type == "SCOUT"]
        idle_rescues = [a for a in self.agents.values() if a.agent_type == "RESCUE" and getattr(a, 'survivors_onboard', 0) == 0]

        if self.active_baseline == "AMIS-RU" and idle_scouts:
            if self.weather and (self.weather.get('rain_intensity', 0) > 80 or self.weather.get('storm_category', 0) >= 3):
                self.add_event("[System] AI RATIONALE: Severe weather detected. Inflating priority for High Danger zones (p_danger > 75%).")
            node_count = len(world_state.belief.nodes)
            if node_count > 5000:
                self.add_event("[System] AI RATIONALE: Massive area size detected. Expanding Scout sweep radius to 4500m phase-1.")
            elif node_count < 1000:
                self.add_event("[System] AI RATIONALE: Minimal area size detected. Restricting Scout sweep radius to 1500m phase-1.")
                
            scout_assignments = self.coordinator.assign_scouts(world_state.belief, idle_scouts, self.weather)
            for assign in scout_assignments:
                agent = self.agents[assign['scout_id']]
                agent.target_node = assign['target_node_id']
                agent.route = assign['path']
                agent.full_planned_route = [agent.current_node] + assign['path']
                agent.status = AgentStatus.MOVING
                agent.progress_on_edge = 0.0
                agent.next_node = None

        if idle_rescues:
            rescue_assignments = self.coordinator.assign_rescues(world_state.belief, idle_rescues, self.weather)
            for assign in rescue_assignments:
                agent = self.agents[assign['team_id']]
                agent.target_node = assign['target_node_id']
                agent.route = assign['path']
                agent.full_planned_route = [agent.current_node] + assign['path']
                agent.status = AgentStatus.MOVING
                agent.progress_on_edge = 0.0
                agent.next_node = None

    def generate_phase_plan(self):
        """Calculates optimal routes for all idle agents and generates a human-readable rationale."""
        from backend.routing.confidence_dijkstra import calculate_edge_cost
        from backend.world_model.global_memory import gmm
        
        # Precompute edge costs
        for u, v, d in world_state.belief.edges(data=True):
            d['cost_STANDARD_CAR'] = calculate_edge_cost(world_state.belief, u, v, d, 'STANDARD_CAR', disaster_type=self.disaster_type)
            d['cost_ZODIAC_BOAT'] = calculate_edge_cost(world_state.belief, u, v, d, 'ZODIAC_BOAT', disaster_type=self.disaster_type)
            d['cost_HIGH_WATER_TRUCK'] = calculate_edge_cost(world_state.belief, u, v, d, 'HIGH_WATER_TRUCK', disaster_type=self.disaster_type)
            d['cost_HELICOPTER'] = calculate_edge_cost(world_state.belief, u, v, d, 'HELICOPTER', disaster_type=self.disaster_type)
            d['cost_SCOUT_CAR'] = calculate_edge_cost(world_state.belief, u, v, d, 'SCOUT_CAR', disaster_type=self.disaster_type)
            
        gmm.compile_graph_to_tensor(world_state.belief)

        idle_scouts = [a for a in self.agents.values() if a.agent_type == "SCOUT" and (a.status == AgentStatus.IDLE or not a.route)]
        idle_rescues = [a for a in self.agents.values() if a.agent_type == "RESCUE" and (a.status == AgentStatus.IDLE or not a.route) and getattr(a, 'survivors_onboard', 0) == 0]

        scout_targets = []
        rescue_targets = []

        if idle_scouts:
            scout_assignments = self.coordinator.assign_scouts(world_state.belief, idle_scouts, self.weather)
            for assign in scout_assignments:
                agent = self.agents[assign['scout_id']]
                if assign.get('path'):
                    agent.route = list(assign['path'])
                    agent.target_node = agent.route[-1]
                    agent.full_planned_route = [agent.current_node] + list(assign['path'])
                    scout_targets.append(agent.target_node)

        if idle_rescues:
            rescue_assignments = self.coordinator.assign_rescues(world_state.belief, idle_rescues, self.weather)
            for assign in rescue_assignments:
                agent = self.agents[assign['team_id']]
                if assign.get('path'):
                    agent.route = list(assign['path'])
                    agent.target_node = agent.route[-1]
                    agent.full_planned_route = [agent.current_node] + list(assign['path'])
                    rescue_targets.append(agent.target_node)

        # Calculate stage predictions
        self.current_stage = getattr(self, 'current_stage', 0) + 1
        
        total_stranded = sum(
            d.get('population', 0) 
            for n, d in world_state.belief.nodes(data=True) 
            if d.get('node_type') == 'POPULATION_ZONE'
        )
        fleet_capacity = sum(a.capacity for a in self.agents.values() if getattr(a, 'capacity', 0) > 0)
        
        # A rough heuristic: if we need to pick up `total_stranded` people and can only hold `fleet_capacity` at a time,
        # it takes roughly total_stranded / fleet_capacity trips. Add 2 for scouting stages.
        self.estimated_total_stages = 2 + math.ceil(total_stranded / max(1, fleet_capacity))
        if self.current_stage > self.estimated_total_stages:
            self.estimated_total_stages = self.current_stage

        # Generate Rationale
        avg_danger = 0
        nodes_checked = 0
        for n, d in world_state.belief.nodes(data=True):
            if d.get("node_type") == "POPULATION_ZONE":
                avg_danger += d.get("p_danger", 0)
                nodes_checked += 1
        
        avg_danger = avg_danger / max(1, nodes_checked)
        risk_str = "High" if avg_danger > 0.6 else "Medium" if avg_danger > 0.3 else "Low"
        
        assigned_names = []
        if idle_scouts:
            assigned_names.append(f"{len(idle_scouts)} Scout(s)")
        if idle_rescues:
            assigned_names.append(f"{len(idle_rescues)} Rescue Team(s)")
            
        # NDMA EOC Operational Plan Format
        objectives = []
        obj_id = 1
        
        if scout_targets:
            objectives.append({
                "id": f"Objective {obj_id}",
                "description": f"Reconnaissance of {len(scout_targets)} high-risk nodes",
                "priority": "High",
                "assigned_units": [f"{a.id} (Drone)" for a in idle_scouts],
                "eta": f"{max(8, int(avg_danger * 20))} min"
            })
            obj_id += 1
            
        if rescue_targets:
            objectives.append({
                "id": f"Objective {obj_id}",
                "description": f"Evacuate {len(rescue_targets)} populated zones",
                "priority": "Critical",
                "assigned_units": [f"{a.id} (National Rescue)" for a in idle_rescues],
                "eta": f"{max(15, int(avg_danger * 40))} min"
            })
            
        self.latest_briefing = {
            "operation_name": f"Operation River Shield - Phase {self.current_stage}",
            "objectives": objectives,
            "risk": risk_str,
            "weather": self.weather.value if hasattr(self.weather, 'value') else (str(self.weather) if self.weather else "CLEAR"),
            "primary_hazards": "Flooded intersections, Bridge collapse risk" if risk_str == "High" else "Debris, Comm blindspots"
        }

    def execute_phase(self):
        """Advances the engine rapidly until agents hit targets or 30 ticks pass."""
        if self.paused_for_decision:
            print("SIMULATION PAUSED: Awaiting strategic decision resolution.")
            return
        ticks = 0
        # Set all agents with a route to MOVING
        for agent in self.agents.values():
            if agent.route:
                agent.status = AgentStatus.MOVING
                
        while ticks < 30:
            if self.paused_for_decision:
                break
            self.step()
            ticks += 1
            # Check if anyone is still moving with a route
            moving = [a for a in self.agents.values() if a.status == AgentStatus.MOVING and a.route]
            if not moving:
                break
        
        # After execution, clear the rationale
        self.latest_rationale = None


    def step(self):
        """Advances the simulation by one discrete time step (1 minute)."""
        if self.paused_for_decision:
            print("SIMULATION PAUSED: Awaiting strategic decision resolution.")
            return
        self.simulation_time += 1
        self.world_version += 1
        print(f"DEBUG ENGINE STEP: {self.simulation_time} (World Version: {self.world_version})", flush=True)
        delta_t = settings.TIMESTEP_DURATION
        gamma = settings.SURVIVAL_DECAY_RATE
        
        # Cycle tide phase every 8 steps (e.g. 0-7 Low, 8-15 High)
        is_high_tide = (self.simulation_time // 8) % 2 == 1
        new_tide = "HIGH TIDE" if is_high_tide else "LOW TIDE"
        if new_tide != getattr(self, 'tide_phase', "LOW TIDE"):
            self.tide_phase = new_tide
            gate_status = "CLOSED (Drainage Halted)" if is_high_tide else "OPEN (Drainage Active)"
            self.add_event(f"[{self.simulation_time}m] 🌊 TIDE UPDATE: Phase changed to {self.tide_phase}. Municipal outfall gates are now {gate_status}.")
            
            # Phase 10: Dynamic Replanning Trigger
            self.replanning_required = True
            self.replanning_reason = f"Tide shift to {new_tide}"
            self.add_xai_event(
                action="Halting Operations - Environmental Shift",
                reason=f"Tidal shift to {new_tide} alters traversal risks and water depths.",
                requires_approval=True,
                recommendation="Trigger Phase Re-planning to adapt to new flood models."
            )
            
        t_physics_start = time.perf_counter()
        
        # Reset edge congestion factors at the start of each step
        for u, v, d in world_state.ground_truth.edges(data=True):
            d['congestion_factor'] = 1.0
            if u in world_state.belief.edges and v in world_state.belief.edges[u]:
                world_state.belief.edges[u, v]['congestion_factor'] = 1.0

        # Civilian Evacuation & Stuck SMS tracking (Phase 2)
        if self.broadcast_mode == "DIRECTED_EVACUATION":
            active_view = nx.subgraph_view(world_state.ground_truth, filter_edge=lambda uu, vv: not world_state.ground_truth.edges[uu, vv].get('blocked', False))
            havens = [n for n, data in world_state.ground_truth.nodes(data=True) if data.get('node_type') in ("SHELTER", "HOSPITAL")]
            
            for n_id, ndata in list(world_state.ground_truth.nodes(data=True)):
                if ndata.get('node_type') == 'POPULATION_ZONE' and ndata.get('population', 0) > 0:
                    p_danger = ndata.get('p_danger', 0.0)
                    if p_danger < 0.5 and havens:
                        best_path = None
                        best_dist = float('inf')
                        for haven in havens:
                            if nx.has_path(active_view, n_id, haven):
                                try:
                                    path = nx.shortest_path(active_view, n_id, haven, weight='distance')
                                    d_val = sum(active_view.edges[path[i], path[i+1]].get('distance', 1.0) for i in range(len(path)-1))
                                    if d_val < best_dist:
                                        best_dist = d_val
                                        best_path = path
                                except Exception:
                                    pass
                                    
                        if best_path:
                            evac_size = max(5, int(ndata['population'] * 0.10))
                            evac_size = min(evac_size, ndata['population'])
                            
                            ndata['population'] -= evac_size
                            if n_id in world_state.belief.nodes:
                                world_state.belief.nodes[n_id]['population'] = ndata['population']
                            
                            target_haven = best_path[-1]
                            world_state.ground_truth.nodes[target_haven]['occupants'] = world_state.ground_truth.nodes[target_haven].get('occupants', 0) + evac_size
                            if target_haven in world_state.belief.nodes:
                                world_state.belief.nodes[target_haven]['occupants'] = world_state.belief.nodes[target_haven].get('occupants', 0) + evac_size
                            self.total_survivors_saved += evac_size
                            
                            # Convert raw IDs to human names
                            src_name = world_state.get_node_human_name(n_id)
                            haven_name = world_state.get_node_human_name(target_haven)
                            self.add_event(f"[{self.simulation_time}m] 🚶 AUTONOMOUS EVAC: {evac_size} civilians safely evacuated from {src_name} to haven {haven_name}.")
                            
                            for i in range(len(best_path) - 1):
                                uu, vv = best_path[i], best_path[i+1]
                                world_state.ground_truth.edges[uu, vv]['congestion_factor'] = world_state.ground_truth.edges[uu, vv].get('congestion_factor', 1.0) + 0.5
                                if uu in world_state.belief.edges and vv in world_state.belief.edges[uu]:
                                    world_state.belief.edges[uu, vv]['congestion_factor'] = world_state.ground_truth.edges[uu, vv]['congestion_factor']
                                    
                            self.civilian_stuck_timers[n_id] = 0
                        else:
                            stuck_count = self.civilian_stuck_timers.get(n_id, 0) + 1
                            self.civilian_stuck_timers[n_id] = stuck_count
                            
                            if stuck_count >= 3:
                                for neighbor in world_state.ground_truth.neighbors(n_id):
                                    gt_edge = world_state.ground_truth.edges[n_id, neighbor]
                                    belief_edge = world_state.belief.edges.get((n_id, neighbor)) or world_state.belief.edges.get((neighbor, n_id))
                                    if gt_edge.get('blocked', False) and belief_edge and not belief_edge.get('blocked', False):
                                        belief_edge['blocked'] = True
                                        belief_edge['confidence'] = 1.0
                                        src_name = world_state.get_node_human_name(n_id)
                                        tgt_name = world_state.get_node_human_name(neighbor)
                                        road_name = belief_edge.get('name', 'Unnamed Road')
                                        self.add_event(f"[{self.simulation_time}m] 📡 SMS ALERT: Stuck civilians pinged from {src_name}. Segment '{road_name}' ({src_name} ↔ {tgt_name}) marked as BLOCKED.")
                                        break
                                self.civilian_stuck_timers[n_id] = 0

        # Adjust survival decay rate (gamma) and triage exposure scaling per disaster scenario
        base_gamma = settings.SURVIVAL_DECAY_RATE
        disaster_upper = self.disaster_type.upper()
        if disaster_upper == "EARTHQUAKE":
            gamma = base_gamma * 8.0     # 8x faster decay for trapped rubble victims
            imm_multiplier = 1.8
            del_multiplier = 1.0
        elif disaster_upper == "CYCLONE":
            gamma = base_gamma * 3.0     # 3x faster decay for flying debris/wind casualties
            imm_multiplier = 1.3
            del_multiplier = 1.2
        else:                            # FLOOD or default
            gamma = base_gamma * 1.0     # Baseline slow decay
            imm_multiplier = 0.5
            del_multiplier = 0.8
        
        # --- 1. POPULATION DECAY & TRIAGE CLASSIFICATION (Ground Truth) ---
        for n_id, data in world_state.ground_truth.nodes(data=True):
            pop = data.get('population', 0)
            p_danger = data.get('p_danger', 0.0)
            if pop > 0:
                if p_danger > 0.5:
                    new_pop = int(pop * max(0.0, 1.0 - (gamma * p_danger)))
                    pop = new_pop
                    world_state.ground_truth.nodes[n_id]['population'] = pop
                    
                # Update triage buckets based on hazard exposure (p_danger)
                imm_ratio = min(0.5, p_danger * imm_multiplier)
                del_ratio = min(0.4, p_danger * del_multiplier)
                
                t_imm = int(pop * imm_ratio)
                t_del = int(pop * del_ratio)
                t_min = pop - t_imm - t_del
                
                world_state.ground_truth.nodes[n_id]['triage_immediate'] = t_imm
                world_state.ground_truth.nodes[n_id]['triage_delayed'] = t_del
                world_state.ground_truth.nodes[n_id]['triage_minor'] = t_min

        # --- DYNAMIC FLOOD PROGRESSION ---
        if self.disaster_type == "FLOOD" and self.active_baseline != "BASELINE-A":
            from backend.disaster.flood import FloodModule
            # High tide scales rainfall accumulation significantly (outfall gates closed)
            rain_rate = 1.2 if is_high_tide else 0.55
            flood_mod = FloodModule(rainfall=rain_rate)
            newly_blocked = flood_mod.update_simulation_step(world_state.ground_truth, self.simulation_time)
            for u, v in newly_blocked:
                # Sync blockages to belief
                world_state.belief.edges[u, v]['blocked'] = True
                world_state.belief.edges[u, v]['confidence'] = 1.0
                self.add_event(f"[{self.simulation_time}m] 🚨 ROAD CLOSED: {u} ↔ {v} is submerged under floodwaters!")
                
            # If Low tide, apply natural drainage (water levels slowly recede)
            if not is_high_tide:
                for n_id, data in world_state.ground_truth.nodes(data=True):
                    wl = data.get('water_level', 0.0)
                    if wl > 0.0:
                        new_wl = max(0.0, wl - 3.2)
                        data['water_level'] = new_wl
                        # If water recedes below flooding threshold, recover status
                        if new_wl < 10.0 and data.get('status') == "FLOODED":
                            data['status'] = "SAFE"
                            data['p_danger'] = max(0.05, data.get('p_danger', 0.0) - 0.5)
                            # Sync back to belief
                            if n_id in world_state.belief:
                                world_state.belief.nodes[n_id]['status'] = "SAFE"
                                world_state.belief.nodes[n_id]['p_danger'] = data['p_danger']
                                world_state.belief.nodes[n_id]['water_level'] = new_wl
                                
        elif self.disaster_type.upper() == "EARTHQUAKE" and self.active_baseline != "BASELINE-A":
            from backend.disaster.earthquake import EarthquakeModule
            eq_mod = EarthquakeModule()
            newly_blocked = eq_mod.update_simulation_step(world_state.ground_truth, self.simulation_time)
            for u, v in newly_blocked:
                # Sync blockages to belief
                world_state.belief.edges[u, v]['blocked'] = True
                world_state.belief.edges[u, v]['confidence'] = 1.0
                self.add_event(f"[{self.simulation_time}m] 🚨 STRUCTURAL FAILURE: road {u} ↔ {v} collapsed due to seismic aftershocks!")
        elif self.disaster_type.upper() == "WILDFIRE" and self.active_baseline != "BASELINE-A":
            from backend.disaster.wildfire import WildfireModule
            wind_ms = 8.0
            wind_dir = 225.0
            if self.weather and 'current_weather' in self.weather:
                cw = self.weather['current_weather']
                wind_ms = cw.get('windspeed', 28.8) / 3.6
                wind_dir = cw.get('winddirection', 225.0)
            wf_mod = WildfireModule(wind_speed_ms=wind_ms, wind_direction_deg=wind_dir)
            newly_blocked = wf_mod.update_simulation_step(world_state.ground_truth, self.simulation_time)
            for u, v in newly_blocked:
                # Sync blockages to belief
                world_state.belief.edges[u, v]['blocked'] = True
                world_state.belief.edges[u, v]['confidence'] = 1.0
                self.add_event(f"[{self.simulation_time}m] 🚨 ROAD CLOSED: road {u} ↔ {v} is blocked by active wildfire front!")

        # --- HAVEN RESOURCE DECAY ---
        for n_id, data in world_state.ground_truth.nodes(data=True):
            if data.get('node_type') in ("SHELTER", "HOSPITAL"):
                occupants = data.get('occupants', 0)
                resources = data.get('resources', {"food": 100.0, "water": 100.0, "medicine": 100.0, "fuel": 100.0})
                
                # Decay rates proportional to occupants
                decay_rate = 0.02 + 0.05 * occupants
                resources['food'] = max(0.0, resources['food'] - decay_rate)
                resources['water'] = max(0.0, resources['water'] - decay_rate - 0.01)
                
                med_decay = 0.01 + 0.03 * data.get('p_danger', 0.0) * occupants
                resources['medicine'] = max(0.0, resources['medicine'] - med_decay)
                resources['fuel'] = max(0.0, resources['fuel'] - 0.1)
                
                data['resources'] = resources
                if n_id in world_state.belief:
                    world_state.belief.nodes[n_id]['resources'] = resources.copy()
                    world_state.belief.nodes[n_id]['occupants'] = occupants

                # Warnings
                if resources['food'] < 20.0 and not data.get('warned_food', False):
                    data['warned_food'] = True
                    self.add_event(f"[{self.simulation_time}m] ⚠️ SUPPLY ALERT: Haven {n_id} is running critically low on Food!")
                if resources['water'] < 20.0 and not data.get('warned_water', False):
                    data['warned_water'] = True
                    self.add_event(f"[{self.simulation_time}m] ⚠️ SUPPLY ALERT: Haven {n_id} is running critically low on Water!")

        # --- CHECK COMMS BLACKOUTS FOR AGENTS ---
        for agent in self.agents.values():
            lat = world_state.ground_truth.nodes[agent.current_node].get('y', world_state.ground_truth.nodes[agent.current_node].get('lat'))
            lon = world_state.ground_truth.nodes[agent.current_node].get('x', world_state.ground_truth.nodes[agent.current_node].get('lon'))
            in_blackout = is_in_blackout_zone(lat, lon, self.blackout_zones)
            
            if in_blackout and not agent.comms_blackout:
                agent.comms_blackout = True
                self.add_event(f"[{self.simulation_time}m] 🚫 COMMS LOST: {agent.id} entered a communication blackout zone. Presumed compromised.")
                
                # Failsafe Protocol: Purge downed agent from Ledger and dispatch reinforcements
                if agent.target_node:
                    self.add_event(f"[System] AI RATIONALE: CASUALTY / BLACKOUT DETECTED. Stripping {agent.id}'s target from Ledger and preparing immediate reinforcement dispatch.")
                    
                    if agent.agent_type == "RESCUE":
                        # Strip capacity so another team can spawn
                        vehicle_cap = 50 if getattr(agent, 'vehicle_type', 'STANDARD_CAR') == "AMBULANCE" else 100
                        gmm.free_capacity(agent.target_node, vehicle_cap)
                    
                    elif agent.agent_type == "SCOUT":
                        # Remove from cleared nodes so it gets swept again
                        if gmm.is_cleared(agent.target_node):
                            gmm.clearance_ledger.remove(agent.target_node)
                            
                    # Abort their mission
                    agent.target_node = None
                    agent.route = []
                    agent.status = AgentStatus.IDLE
                    
            elif not in_blackout and agent.comms_blackout:
                agent.comms_blackout = False
                self.add_event(f"[{self.simulation_time}m] 📶 COMMS RESTORED: {agent.id} exited blackout zone.")
                # Flush pending observations
                if agent.pending_observations:
                    for obs in agent.pending_observations:
                        apply_scout_observation(world_state.belief, world_state.ground_truth, obs)
                    self.add_xai_event(
                        action=f"Scout {agent.id} flushed {len(agent.pending_observations)} telemetry records to EOC.",
                        reason="Re-established connection to secure comms network."
                    )
                    agent.pending_observations = []

        t_physics_end = time.perf_counter()
        self.last_telemetry["physics_ms"] = (t_physics_end - t_physics_start) * 1000

        t_belief_start = time.perf_counter()
        # --- 2. DECAY INFORMATION (Belief) ---
        if self.active_baseline != "BASELINE-A":
            # Baseline-A operates on frozen/no decay assumption
            decay_confidence(world_state.belief, settings.KNOWLEDGE_DECAY_RATE)

        # Precompute edge costs for fast routing with dynamic congestion multiplier (BPR function)
        from backend.routing.confidence_dijkstra import calculate_edge_cost
        from backend.routing.cost_config import BPR_ALPHA, BPR_BETA, ROAD_CAPACITIES
        
        # Calculate active vehicle flow count per edge
        edge_flows = {}
        for agent in self.agents.values():
            if agent.status == AgentStatus.MOVING and agent.current_node and agent.next_node:
                edge_key = tuple(sorted((agent.current_node, agent.next_node)))
                edge_flows[edge_key] = edge_flows.get(edge_key, 0) + 1

        for u, v, d in world_state.belief.edges(data=True):
            # Compute dynamic congestion factor
            edge_key = tuple(sorted((u, v)))
            flow = edge_flows.get(edge_key, 0)
            road_type = d.get('highway', 'residential')
            capacity = ROAD_CAPACITIES.get(road_type, 400)
            
            # travel_time_factor = 1 + alpha * (flow/capacity)^beta
            congestion_multiplier = 1.0 + BPR_ALPHA * ((flow / capacity) ** BPR_BETA)
            
            d['cost_STANDARD_CAR'] = calculate_edge_cost(world_state.belief, u, v, d, 'STANDARD_CAR', disaster_type=self.disaster_type) * congestion_multiplier
            d['cost_ZODIAC_BOAT'] = calculate_edge_cost(world_state.belief, u, v, d, 'ZODIAC_BOAT', disaster_type=self.disaster_type) * congestion_multiplier
            d['cost_HIGH_WATER_TRUCK'] = calculate_edge_cost(world_state.belief, u, v, d, 'HIGH_WATER_TRUCK', disaster_type=self.disaster_type) * congestion_multiplier
            d['cost_HELICOPTER'] = calculate_edge_cost(world_state.belief, u, v, d, 'HELICOPTER', disaster_type=self.disaster_type) * congestion_multiplier
            d['cost_SCOUT_CAR'] = calculate_edge_cost(world_state.belief, u, v, d, 'SCOUT_CAR', disaster_type=self.disaster_type) * congestion_multiplier
            
        # Reset and compute High-Value Targets (HVTs) using counter-factual routing
        for u, v, d in world_state.belief.edges(data=True):
            d['hvt'] = False
            d['hvt_priority'] = 0
        for u, v, d in world_state.ground_truth.edges(data=True):
            d['hvt'] = False
            d['hvt_priority'] = 0

        try:
            if self.coordinator is None:
                return
            active_view = nx.subgraph_view(world_state.belief, filter_edge=lambda u, v: not world_state.belief.edges[u, v].get('blocked', False))
            base_node = self.coordinator.base_node
            for n_id, ndata in world_state.belief.nodes(data=True):
                if ndata.get('population', 0) > 0 and n_id != base_node:
                    if nx.has_path(active_view, base_node, n_id) and nx.has_path(world_state.belief, base_node, n_id):
                        p_actual = nx.shortest_path(active_view, base_node, n_id, weight='distance')
                        p_optimal = nx.shortest_path(world_state.belief, base_node, n_id, weight='distance')
                        
                        dist_actual = sum(world_state.belief.edges[p_actual[i], p_actual[i+1]].get('distance', 1.0) for i in range(len(p_actual)-1))
                        dist_optimal = sum(world_state.belief.edges[p_optimal[i], p_optimal[i+1]].get('distance', 1.0) for i in range(len(p_optimal)-1))
                        
                        if dist_actual >= 1.4 * dist_optimal:
                            for i in range(len(p_optimal)-1):
                                uu, vv = p_optimal[i], p_optimal[i+1]
                                if world_state.belief.edges[uu, vv].get('blocked', False):
                                    detour_saved = max(1.0, dist_actual - dist_optimal)
                                    pop = ndata.get('population', 0)
                                    val = max(1, int(detour_saved * pop))
                                    
                                    world_state.belief.edges[uu, vv]['hvt'] = True
                                    prev_belief_prio = world_state.belief.edges[uu, vv].get('hvt_priority', 0)
                                    world_state.belief.edges[uu, vv]['hvt_priority'] = prev_belief_prio + val
                                    
                                    world_state.ground_truth.edges[uu, vv]['hvt'] = True
                                    prev_gt_prio = world_state.ground_truth.edges[uu, vv].get('hvt_priority', 0)
                                    world_state.ground_truth.edges[uu, vv]['hvt_priority'] = prev_gt_prio + val
        except Exception as ex:
            print(f"[HVT] Error running counter-factual analysis: {ex}")

        # Dynamically Recompile Vector Graph Matrix and DEST edge state tensors
        t_tensor_start = time.perf_counter()
        gmm.compile_graph_to_tensor(world_state.belief)
        
        # Initialize DEST tensor if not yet allocated
        if not hasattr(world_state, 'edge_state_tensor'):
            from backend.world_model.edge_state_tensor import EdgeStateTensor
            world_state.edge_state_tensor = EdgeStateTensor(len(world_state.belief.edges))
        world_state.edge_state_tensor.sync_from_graph(world_state.belief, self.simulation_time)
        t_tensor_end = time.perf_counter()
        self.last_telemetry["tensor_ms"] = (t_tensor_end - t_tensor_start) * 1000

        t_belief_end = time.perf_counter()
        self.last_telemetry["belief_ms"] = (t_belief_end - t_belief_start) * 1000

        t_alloc_start = time.perf_counter()
        # --- 3. COORDINATOR ALLOCATION ---
        # Separate idle agents
        idle_scouts = [a for a in self.agents.values() if a.agent_type == "SCOUT" and a.status == AgentStatus.IDLE and not getattr(a, 'is_manual_override', False)]
        idle_rescues = [a for a in self.agents.values() if a.agent_type == "RESCUE" and a.status == AgentStatus.IDLE and not getattr(a, 'is_manual_override', False) and getattr(a, 'survivors_onboard', 0) == 0]
        
        # Reroute stranded idle rescue agents that have survivors onboard
        stranded_rescues = [a for a in self.agents.values() if a.agent_type == "RESCUE" and a.status == AgentStatus.IDLE and getattr(a, 'survivors_onboard', 0) > 0]
        for agent in stranded_rescues:
            haven_path = self.coordinator.find_nearest_safe_haven(
                world_state.belief, 
                agent.current_node, 
                needs_medical=getattr(agent, 'survivors_immediate', 0) > 0, 
                vehicle_type=getattr(agent, 'vehicle_type', 'STANDARD_CAR')
            )
            if haven_path:
                if haven_path[0] == agent.current_node:
                    haven_path.pop(0)
                agent.route = haven_path
                agent.full_planned_route = [agent.current_node] + haven_path
                agent.target_node = haven_path[-1] if haven_path else agent.current_node
                agent.status = AgentStatus.MOVING
                agent.next_node = None
                agent.progress_on_edge = 0.0
        # Scouting allocation (Skip for Baseline A)
        if self.active_baseline == "AMIS-RU" and idle_scouts:
            if self.weather and (self.weather.get('rain_intensity', 0) > 80 or self.weather.get('storm_category', 0) >= 3):
                self.add_event("[System] AI RATIONALE: Severe weather detected. Routing Rescue teams immediately to high priority targets.")
            scout_assignments = self.coordinator.assign_scouts(world_state.belief, idle_scouts, self.weather)
            for assign in scout_assignments:
                agent = self.agents[assign['scout_id']]
                agent.target_node = assign['target_node_id']
                agent.route = assign['path']
                agent.full_planned_route = [agent.current_node] + assign['path']  # store full corridor
                agent.status = AgentStatus.MOVING
                agent.progress_on_edge = 0.0
                agent.next_node = None
                
        elif self.active_baseline == "BASELINE-B" and idle_scouts:
            # Baseline B: Scouts only run in the first 15 steps
            if self.simulation_time <= 15:
                scout_assignments = self.coordinator.assign_scouts(world_state.belief, idle_scouts, self.weather)
                for assign in scout_assignments:
                    agent = self.agents[assign['scout_id']]
                    agent.target_node = assign['target_node_id']
                    agent.route = assign['path']
                    agent.full_planned_route = [agent.current_node] + assign['path']
                    agent.status = AgentStatus.MOVING
                    agent.progress_on_edge = 0.0
                    agent.next_node = None

        # Rescue allocation
        allow_rescue = True
        if self.active_baseline == "BASELINE-B":
            # Baseline B: Rescue teams only run after step 15
            if self.simulation_time <= 15:
                allow_rescue = False
                
        if allow_rescue and idle_rescues:
            rescue_assignments = self.coordinator.assign_rescues(world_state.belief, idle_rescues, self.weather)
            for assign in rescue_assignments:
                agent = self.agents[assign['team_id']]
                agent.target_node = assign['target_node_id']
                agent.route = assign['path']
                agent.full_planned_route = [agent.current_node] + assign['path']
                agent.status = AgentStatus.MOVING
                agent.progress_on_edge = 0.0
                agent.next_node = None
                
                # Fetch UWEV explainability attributes to feed Explain AI Panel
                ev = assign.get('ev', 0.0)
                t_arrival = assign.get('distance', 0.0) / 10.0 / 60.0  # approximate time minutes
                self.add_xai_event(
                    action=f"Rescue team {agent.id} dispatched to zone {world_state.get_node_human_name(agent.target_node)}",
                    reason=f"Mission expected utility is {ev:.2f}. Est travel time: {t_arrival:.1f} min. souls: {world_state.belief.nodes[agent.target_node].get('population', 0)}",
                    confidence=world_state.belief.nodes[agent.target_node].get('p_state_correct', 1.0)
                )

        t_alloc_end = time.perf_counter()
        self.last_telemetry["allocation_ms"] = (t_alloc_end - t_alloc_start) * 1000

        t_sim_start = time.perf_counter()
        # --- 4. EXECUTE AGENT ACTIONS & MOVEMENT ---
        for agent_id, agent in self.agents.items():
            if agent.status == AgentStatus.MOVING:
                # If agent doesn't have a specific segment edge, fetch next node on route
                if agent.next_node is None:
                    if agent.route:
                        next_node = agent.route.pop(0)
                        while next_node == agent.current_node and agent.route:
                            next_node = agent.route.pop(0)
                        if next_node == agent.current_node:
                            if agent.current_node == agent.target_node:
                                self._reached_target(agent)
                            else:
                                agent.status = AgentStatus.IDLE
                                agent.target_node = None
                            continue
                        agent.next_node = next_node
                        agent.progress_on_edge = 0.0
                    else:
                        # Route is empty, check if we reached target
                        if agent.current_node == agent.target_node:
                            self._reached_target(agent)
                        else:
                            agent.status = AgentStatus.IDLE
                        continue
                
                # Check segment properties
                u, v = agent.current_node, agent.next_node
                if not world_state.ground_truth.has_edge(u, v):
                    agent.next_node = None
                    agent.progress_on_edge = 0.0
                    agent.route = []
                    agent.status = AgentStatus.IDLE
                    continue
                    
                edge_data = world_state.ground_truth.edges[u, v]
                distance = edge_data.get('distance', 100.0)
                
                # Fetch water level of the segment
                wl_u = world_state.ground_truth.nodes[u].get('water_level', 0.0)
                wl_v = world_state.ground_truth.nodes[v].get('water_level', 0.0)
                water_level = max(wl_u, wl_v)
                is_blocked = edge_data.get('blocked', False)
                
                p_danger_edge = (world_state.ground_truth.nodes[u].get('p_danger', 0.0) + world_state.ground_truth.nodes[v].get('p_danger', 0.0)) / 2.0
                from backend.agents.fleet_config import get_effective_speed
                eff_speed = get_effective_speed(getattr(agent, 'vehicle_type', 'STANDARD_CAR'), agent.speed, water_level, is_blocked, disaster_type=self.disaster_type, p_danger=p_danger_edge)
                
                if eff_speed <= 0.0:
                    # Agent is blocked on the edge!
                    agent.next_node = None
                    agent.progress_on_edge = 0.0
                    agent.route = []
                    agent.status = AgentStatus.IDLE
                    
                    # Update BeliefGraph to reflect this blockage (Helicopters ignore blockages)
                    if getattr(agent, 'vehicle_type', 'STANDARD_CAR') != "HELICOPTER":
                        if not getattr(agent, 'comms_blackout', False):
                            world_state.belief.edges[u, v]['blocked'] = True
                            world_state.belief.edges[u, v]['confidence'] = 1.0
                    continue
                
                # Traverse segment taking road class speed limits and fleet speed multiplier into account
                road_factor = edge_data.get('speed_factor', 1.0)
                congestion = edge_data.get('congestion_factor', 1.0)
                effective_speed = eff_speed * road_factor
                
                # Apply traffic congestion penalty for land vehicles
                if getattr(agent, 'vehicle_type', 'STANDARD_CAR') != "HELICOPTER":
                    effective_speed = effective_speed / max(1.0, congestion)
                    
                if distance <= 0.0:
                    agent.progress_on_edge = 1.0
                else:
                    agent.progress_on_edge += (effective_speed * delta_t) / distance
                
                if agent.progress_on_edge >= 1.0:
                    # Traveled the segment
                    agent.current_node = agent.next_node
                    if not hasattr(agent, 'history_route'):
                        agent.history_route = []
                    agent.history_route.append(agent.current_node)
                    agent.next_node = None
                    agent.progress_on_edge = 0.0
                    
                    # Update BeliefGraph to reflect this road is clear
                    if not getattr(agent, 'comms_blackout', False):
                        world_state.belief.edges[u, v]['blocked'] = False
                        world_state.belief.edges[u, v]['confidence'] = 1.0
                        world_state.belief.edges[u, v]['cleared'] = True
                    
                    if agent.current_node == agent.target_node:
                        self._reached_target(agent)
                        
            elif agent.status == AgentStatus.OBSERVING:
                agent.action_timer -= 1
                if agent.action_timer <= 0:
                    # Complete observation
                    if agent.comms_blackout:
                        agent.pending_observations.append(agent.current_node)
                        self.add_event(f"[{self.simulation_time}m] 📡 {agent.id} completed scan of {agent.current_node} but telemetry transmission failed (No Comms).")
                    else:
                        apply_scout_observation(world_state.belief, world_state.ground_truth, agent.current_node)
                        world_state.belief.nodes[agent.current_node]['visited_at_least_once'] = True
                    
                    agent.status = AgentStatus.IDLE
                    agent.target_node = None
                    agent.is_manual_override = False
                    
            elif agent.status == AgentStatus.RESCUING:
                agent.action_timer -= 1
                if agent.action_timer <= 0:
                    # Complete rescue operation with triage priority
                    gt_node = world_state.ground_truth.nodes[agent.current_node]
                    gt_pop = gt_node.get('population', 0)
                    rescued = min(agent.capacity, gt_pop)
                    
                    # Prioritize loading (Immediate > Delayed > Minor)
                    imm = gt_node.get('triage_immediate', 0)
                    del_ = gt_node.get('triage_delayed', 0)
                    min_ = gt_node.get('triage_minor', 0)
                    
                    rescued_imm = min(rescued, imm)
                    rescued_del = min(rescued - rescued_imm, del_)
                    rescued_min = min(rescued - rescued_imm - rescued_del, min_)
                    
                    # Ensure sum matches total rescued
                    rem = rescued - (rescued_imm + rescued_del + rescued_min)
                    if rem > 0:
                        rescued_min += rem
                        
                    gt_node['triage_immediate'] = max(0, imm - rescued_imm)
                    gt_node['triage_delayed'] = max(0, del_ - rescued_del)
                    gt_node['triage_minor'] = max(0, min_ - rescued_min)
                    gt_node['population'] = gt_pop - rescued
                    
                    world_state.belief.nodes[agent.current_node]['population'] = 0
                    
                    agent.survivors_onboard = rescued
                    agent.survivors_immediate = rescued_imm
                    agent.survivors_delayed = rescued_del
                    agent.survivors_minor = rescued_min
                    agent.status = AgentStatus.RETURNING
                    
                    needs_medical = rescued_imm > 0
                    
                    # Coordinate return to nearest safe haven (prioritize hospitals if medical help is needed)
                    haven_path = self.coordinator.find_nearest_safe_haven(
                        world_state.belief, 
                        agent.current_node, 
                        needs_medical=needs_medical, 
                        vehicle_type=getattr(agent, 'vehicle_type', 'STANDARD_CAR')
                    )
                    if haven_path:
                        # Pop the first element since it's the current node
                        if haven_path[0] == agent.current_node:
                            haven_path.pop(0)
                        agent.route = haven_path
                        agent.full_planned_route = [agent.current_node] + haven_path  # evacuation corridor
                        agent.target_node = haven_path[-1] if haven_path else agent.current_node
                        agent.status = AgentStatus.MOVING
                        agent.next_node = None
                        agent.progress_on_edge = 0.0
                    else:
                        # Stalled due to no path
                        agent.status = AgentStatus.IDLE

        # --- OPPORTUNISTIC PASSIVE VERIFICATION (50m Sensor Sweep) ---
        try:
            import math
            for agent in self.agents.values():
                curr_node = agent.current_node
                if not curr_node or curr_node not in world_state.ground_truth:
                    continue
                node_data = world_state.ground_truth.nodes[curr_node]
                agent_lat = node_data.get('lat')
                agent_lon = node_data.get('lon')
                if agent_lat is None or agent_lon is None:
                    continue
                
                # Check all edges in ground truth within ~60 meters (0.0006 degrees)
                for u, v, d in world_state.ground_truth.edges(data=True):
                    u_node = world_state.ground_truth.nodes[u]
                    v_node = world_state.ground_truth.nodes[v]
                    
                    edge_lat = (u_node.get('lat', 0.0) + v_node.get('lat', 0.0)) / 2.0
                    edge_lon = (u_node.get('lon', 0.0) + v_node.get('lon', 0.0)) / 2.0
                    
                    lat_diff = edge_lat - agent_lat
                    lon_diff = edge_lon - agent_lon
                    dist_deg = math.hypot(lat_diff, lon_diff)
                    
                    if dist_deg <= 0.0006:
                        gt_blocked = d.get('blocked', False)
                        if not getattr(agent, 'comms_blackout', False):
                            if world_state.belief.edges[u, v]['blocked'] != gt_blocked:
                                world_state.belief.edges[u, v]['blocked'] = gt_blocked
                                world_state.belief.edges[u, v]['confidence'] = 1.0
                                status_str = "CLOSED/BLOCKED" if gt_blocked else "OPEN/CLEAR"
                                self.add_event(f"[{self.simulation_time}m] 👁️ {agent.id} verified adjacent segment {u} ↔ {v} is {status_str}.")
        except Exception as ex:
            print(f"[Sensor Sweep] Error during passive sweep: {ex}")

        t_sim_end = time.perf_counter()
        self.last_telemetry["routing_ms"] = (t_sim_end - t_sim_start) * 1000

        # Capture metrics history
        self._record_metrics()

        # Phase 2: Check strategic decision triggers
        current_blocked_count = sum(1 for uu, vv, d in world_state.ground_truth.edges(data=True) if d.get('blocked', False))
        blockage_surge = (self.simulation_time > 1) and (current_blocked_count - self.last_blocked_count > 3)
        self.last_blocked_count = current_blocked_count
        
        low_supply_haven = None
        for n, data in world_state.ground_truth.nodes(data=True):
            if data.get('node_type') in ("SHELTER", "HOSPITAL") and n not in self.triggered_havens:
                res = data.get('resources', {})
                if res.get('food', 100) < 20 or res.get('water', 100) < 20:
                    low_supply_haven = n
                    self.triggered_havens.add(n)
                    break
        
        if (self.simulation_time == 5) or low_supply_haven or blockage_surge:
            self.paused_for_decision = True
            
            trigger_reason = ""
            if self.simulation_time == 5:
                trigger_reason = f"Environmental intensity surge at {self.simulation_time}m."
            elif low_supply_haven:
                haven_name = world_state.get_node_human_name(low_supply_haven)
                trigger_reason = f"Haven '{haven_name}' running critically low on supplies."
            elif blockage_surge:
                trigger_reason = f"Sudden cascade blockage event detected on the network."
                
            self.active_decision = {
                "step": self.simulation_time,
                "reason": trigger_reason,
                "options": [
                    {
                        "id": "A",
                        "title": "Establish Safe Routing Corridors",
                        "description": "Increase route safety factors, directing rescue vehicles to bypass high-danger zones even if detours are longer."
                    },
                    {
                        "id": "B",
                        "title": "Air Bridge Cargo Deployment",
                        "description": "Coordinate immediate emergency drone/helicopter supply drops to replenish low havens."
                    },
                    {
                        "id": "C",
                        "title": "Tactical Scout & Clear Protocol",
                        "description": "Equip and direct ground crews to perform aggressive clearing, reducing movement penalties on blocked roads by 50%."
                    }
                ]
            }
            self.add_event(f"[{self.simulation_time}m] 🚨 STRATEGIC TRIGGER: {trigger_reason} Simulation paused for Command decision.")

    def _reached_target(self, agent):
        if agent.agent_type == "SCOUT":
            agent.status = AgentStatus.OBSERVING
            agent.action_timer = 1  # 1 step (1 minute) observing
        elif agent.agent_type == "RESCUE":
            if agent.survivors_onboard > 0:
                # Reached base/haven - offload survivors
                haven_id = agent.current_node
                
                is_safe_haven = world_state.ground_truth.nodes[haven_id].get('node_type') in ("SHELTER", "HOSPITAL")
                if not is_safe_haven:
                    self.add_event(f"[{self.simulation_time}m] ⚠️ {agent.id} arrived at non-safe zone {haven_id} with survivors. Stalling...")
                    agent.status = AgentStatus.IDLE
                    return
                
                if 'occupants' not in world_state.ground_truth.nodes[haven_id]:
                    world_state.ground_truth.nodes[haven_id]['occupants'] = 0
                if 'occupants' not in world_state.belief.nodes[haven_id]:
                    world_state.belief.nodes[haven_id]['occupants'] = 0
                    
                world_state.ground_truth.nodes[haven_id]['occupants'] += agent.survivors_onboard
                world_state.belief.nodes[haven_id]['occupants'] += agent.survivors_onboard
                
                self.total_survivors_saved += agent.survivors_onboard
                p_zone = world_state.ground_truth.nodes[haven_id].get('p_danger', 0.0)
                triage_msg = ""
                if agent.survivors_immediate > 0:
                    triage_msg = " (Critical condition)" if p_zone > 0.8 else ""
                self.add_xai_event(
                    action=f"{agent.id} delivered {agent.survivors_onboard} survivors to haven {haven_id}.",
                    reason=f"Risk level was High. Triage successful." if p_zone > 0.8 else f"Grid sweep evacuation standard procedure."
                )
                
                agent.survivors_onboard = 0
                agent.survivors_immediate = 0
                agent.survivors_delayed = 0
                agent.survivors_minor = 0
                agent.status = AgentStatus.IDLE
                agent.target_node = None
                agent.is_manual_override = False
            else:
                # Reached target population zone
                agent.status = AgentStatus.RESCUING
                agent.action_timer = 2  # 2 steps (2 minutes) rescuing

    def _record_metrics(self):
        # Calculate coverage (verified nodes fraction) based on actually visited nodes
        num_nodes = len(world_state.belief.nodes)
        verified_nodes = sum(
            1 for n, d in world_state.belief.nodes(data=True)
            if d.get('visited_at_least_once', False)
        )
        coverage = verified_nodes / num_nodes if num_nodes > 0 else 0.0
        
        # Calculate map confidence (average confidence)
        total_conf = sum(
            d.get('p_state_correct', 1.0)
            for n, d in world_state.belief.nodes(data=True)
        )
        map_confidence = total_conf / num_nodes if num_nodes > 0 else 1.0
        
        self.history.append({
            "step": self.simulation_time,
            "survivors_saved": self.total_survivors_saved,
            "coverage": coverage,
            "map_confidence": map_confidence,
            "initial_population": self.initial_total_population
        })

    def replenish_supplies(self, node_id: str, amount: float = 50.0):
        if not world_state.ground_truth.nodes:
            return False
            
        gt_node = world_state.ground_truth.nodes.get(node_id)
        belief_node = world_state.belief.nodes.get(node_id)
        
        if not gt_node or not belief_node:
            return False
            
        node_type = gt_node.get('node_type', '')
        if node_type not in ["HOSPITAL", "SHELTER"]:
            return False
            
        # Add resources up to a max of 200%
        if 'resources' in gt_node:
            gt_node['resources']['food'] = min(200.0, gt_node['resources']['food'] + amount)
            gt_node['resources']['water'] = min(200.0, gt_node['resources']['water'] + amount)
            gt_node['warned_food'] = False
            
        if 'resources' in belief_node:
            belief_node['resources']['food'] = min(200.0, belief_node['resources']['food'] + amount)
            belief_node['resources']['water'] = min(200.0, belief_node['resources']['water'] + amount)
            belief_node['warned_food'] = False
            
        self.add_event(f"[{self.simulation_time}m] 🛩️ Emergency Supply Drop (+{amount}) delivered to {node_id}.")
        return True

simulation_engine = SimulationEngine()
