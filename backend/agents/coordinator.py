import networkx as nx
import numpy as np
from typing import Any, Dict, List, Optional, Tuple, Set
from backend.routing.confidence_dijkstra import find_confidence_route
from backend.uncertainty.information_gain import compute_global_ig
from backend.allocation.allocator import allocate_rescue_teams
from backend.agents.base_agent import AgentStatus
from backend.world_model.global_memory import gmm

class Coordinator:
    def __init__(self, base_node: str) -> None:
        self.base_node = base_node

    def assign_scouts(self, belief_graph: nx.Graph, idle_scouts: List[Any], weather_state: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Assigns idle scouts to targets using Rational Distance-Penalty matching (Cost-Benefit analysis).
        Formula: Cost = (Distance ^ 1.2) - (Urgency * 1000) + OverlapPenalty
        This prevents agents from driving across the entire city for a single threat.
        """
        # Maintain Cognitive Ledger
        if weather_state:
            gmm.log_weather(weather_state)
        if not idle_scouts:
            return []
            
        assignments: List[Dict[str, Any]] = []
        idle_scouts_list = list(idle_scouts)
        
        # --- REACHABILITY-BASED AUTO-DISPATCH (ISOLATION CHECK) ---
        try:
            active_edges_view = nx.subgraph_view(belief_graph, filter_edge=lambda u, v: not belief_graph.edges[u, v].get('blocked', False))
            isolated_population_nodes = []
            for n_id, ndata in belief_graph.nodes(data=True):
                if ndata.get('population', 0) > 0 and n_id != self.base_node:
                    if not nx.has_path(active_edges_view, self.base_node, n_id):
                        isolated_population_nodes.append(n_id)
            
            if isolated_population_nodes and idle_scouts_list:
                base_component = nx.descendants(active_edges_view, self.base_node)
                base_component.add(self.base_node)
                
                for target_id in isolated_population_nodes:
                    if not idle_scouts_list:
                        break
                    isolated_component = nx.descendants(active_edges_view, target_id)
                    isolated_component.add(target_id)
                    
                    bridging_edges = []
                    for u in isolated_component:
                        for v in belief_graph.neighbors(u):
                            if v in base_component:
                                bridging_edges.append((v, u))
                                
                    if bridging_edges:
                        best_scout = None
                        best_edge = None
                        best_path = None
                        min_dist = float('inf')
                        
                        for scout in idle_scouts_list:
                            scout_loc = scout.current_node
                            v_type = getattr(scout, 'vehicle_type', 'STANDARD_CAR')
                            w_key = f'cost_{v_type}'
                            
                            for v_node, u_node in bridging_edges:
                                if nx.has_path(active_edges_view, scout_loc, v_node):
                                    try:
                                        path = nx.shortest_path(active_edges_view, scout_loc, v_node, weight=w_key)
                                        d = sum(belief_graph.edges[path[i], path[i+1]].get('distance', 1.0) for i in range(len(path)-1))
                                        if d < min_dist:
                                            min_dist = d
                                            best_scout = scout
                                            best_edge = (v_node, u_node)
                                            best_path = path
                                    except Exception:
                                        continue
                                        
                        if best_scout and best_edge and best_path:
                            assignments.append({
                                "scout_id": best_scout.id,
                                "target_node_id": best_edge[0],
                                "path": best_path[1:] if len(best_path) > 1 else best_path
                            })
                            idle_scouts_list.remove(best_scout)
        except Exception as ex:
            print(f"[Auto-Dispatch] Error checking reachability / isolation: {ex}")
            
        # Calculate GlobalIG for all nodes
        global_ig = compute_global_ig(belief_graph)
        
        # Filter target candidates (high information gain)
        # Exclude base node, and only target nodes with substantial uncertainty
        # Also strictly exclude nodes with dist_to_water <= 0 (sometimes ocean/island edges)
        # to prevent straight lines across the ocean.
        targets = [
            n_id for n_id, ig_val in global_ig.items()
            if ig_val > getattr(params, 'scout_ig_threshold', 0.05)
            and n_id != self.base_node
            and belief_graph.nodes[n_id].get('is_coastal', False) == False # Avoid routing agents to coastal boundaries which might cross oceans
        ]
        
        # Track edges assigned in this step to penalize overlapping routes
        assigned_edges: Set[Tuple[Any, Any]] = set()

        # Calculate map-size based dynamic phases
        node_count = len(belief_graph.nodes)
        phase_1_radius = 2500
        if node_count > 5000:
            phase_1_radius = 4500  # Massive map
        elif node_count < 1000:
            phase_1_radius = 1500  # Small grid

        # Boost priority if weather is severe (p_danger > 0.75)
        is_severe_weather = False
        if weather_state and (weather_state.get('rain_intensity', 0) > 80 or weather_state.get('storm_category', 0) >= 3):
            is_severe_weather = True

        for target_id in list(targets):
            danger_lvl = belief_graph.nodes[target_id].get('p_danger', 0)
            if is_severe_weather and danger_lvl > 0.75:
                global_ig[target_id] = global_ig.get(target_id, 0) + 1.5  # Artificial boost

        # State-Memory Cache to prevent lag from redundant graph traversals
        dijkstra_cache: Dict[str, Dict[Any, float]] = {}

        # Assign scouts using a Phased Sector Sweep
        scouts = sorted(idle_scouts_list, key=lambda s: s.id)
        for scout in scouts:
            scout_loc = scout.current_node
            vehicle_type = getattr(scout, 'vehicle_type', 'STANDARD_CAR')
            weight_key = f'cost_{vehicle_type}'
            cache_key = f"{scout_loc}_{weight_key}"
            
            # Use Tensor-based matrix routing instead of Python loops
            if cache_key not in dijkstra_cache:
                try:
                    dist_matrix, _ = gmm.calculate_distance_matrix(vehicle_type, [scout_loc])
                    if dist_matrix is not None:
                        # Extract the first (and only) row, representing distances from scout_loc
                        row_dists = dist_matrix[0]
                        # Convert tensor array back to dict mapping for legacy compatibility
                        dijkstra_cache[cache_key] = {gmm.node_list[i]: float(d) for i, d in enumerate(row_dists) if not np.isinf(d)}
                    else:
                        dijkstra_cache[cache_key] = nx.single_source_dijkstra_path_length(belief_graph, scout_loc, weight=weight_key)
                except Exception:
                    dijkstra_cache[cache_key] = {}
                    
            full_lengths = dijkstra_cache[cache_key]

            # Asymmetrical Human-like Danger Assessment
            # If the scout is physically near a severe catastrophe (high danger + population),
            # restrict their sweep radius severely so they focus ONLY on local emergencies.
            # Otherwise, allow them to execute massive map-scale sweeps.
            is_local_emergency = False
            for target_id in targets:
                if target_id in full_lengths and full_lengths[target_id] < 1000:
                    danger = belief_graph.nodes[target_id].get('p_danger', 0)
                    pop = belief_graph.nodes[target_id].get('population', 0)
                    if danger > 0.65 and pop > 10:
                        is_local_emergency = True
                        break
            
            # Dynamically restrict radius asymmetrically per unit
            active_radius = 800 if is_local_emergency else phase_1_radius

            # Filter targets to only those reachable within this unit's asymmetrical radius constraint
            local_targets = [t for t in targets if t in full_lengths and full_lengths[t] <= active_radius]
            
            # If no local targets, expand to global to ensure we don't stall
            if not local_targets:
                local_targets = [t for t in targets if t in full_lengths]

            # Sort local targets by information gain descending
            local_targets = sorted(local_targets, key=lambda t: global_ig.get(t, 0), reverse=True)
            available_targets = list(local_targets[:200])

            if not available_targets:
                continue
            
            full_path = [scout_loc]
            current_loc = scout_loc
            targets_to_visit: List[Any] = []
            
            for _ in range(5):  # Generate a multi-stop sweep of 5 targets
                if not available_targets:
                    break
                    
                loop_cache_key = f"{current_loc}_{weight_key}"
                if loop_cache_key not in dijkstra_cache:
                    try:
                        dist_matrix, _ = gmm.calculate_distance_matrix(vehicle_type, [current_loc])
                        if dist_matrix is not None:
                            row_dists = dist_matrix[0]
                            dijkstra_cache[loop_cache_key] = {gmm.node_list[i]: float(d) for i, d in enumerate(row_dists) if not np.isinf(d)}
                        else:
                            dijkstra_cache[loop_cache_key] = nx.single_source_dijkstra_path_length(belief_graph, current_loc, weight=weight_key)
                    except Exception:
                        break
                lengths = dijkstra_cache[loop_cache_key]
                    
                candidate_targets: List[Tuple[Any, float, float, float]] = []
                for target_id in available_targets:
                    if target_id == current_loc or target_id not in lengths:
                        continue
                        
                    # Validate against Persistent Ledger to prevent redundant scans
                    if gmm.is_cleared(target_id):
                        continue
                        
                    dist = lengths[target_id]
                    ig_val = global_ig.get(target_id, 0.0)
                    
                    # Rational Distance-Penalty calculation (Cost vs Reward)
                    # Non-linear distance scaling forcefully stops blind city-crossing
                    from backend.config_params.parameters import params
                    scout_exponent = getattr(params, 'scout_distance_exponent', 1.2)
                    scout_ig_weight = getattr(params, 'scout_ig_weight', 1000.0)
                    raw_cost = (dist ** scout_exponent) - (ig_val * scout_ig_weight)
                    candidate_targets.append((target_id, dist, ig_val, raw_cost))
                    
                candidate_targets.sort(key=lambda x: x[3])
                top_candidates = candidate_targets[:80] # Evaluate more candidates for better distribution
                
                best_cost = float('inf')
                best_target: Optional[Any] = None
                best_path: Optional[List[Any]] = None
                
                for target_id, dist, ig_val, _ in top_candidates:
                    try:
                        path = nx.shortest_path(belief_graph, current_loc, target_id, weight=weight_key)
                    except Exception:
                        continue
                    
                    # Calculate path overlap and check for known blockages
                    overlap_count = 0
                    path_is_blocked = False
                    for i in range(len(path) - 1):
                        u, v = path[i], path[i+1]
                        if belief_graph.edges[u, v].get('blocked', False):
                            path_is_blocked = True
                            break
                        if (u, v) in assigned_edges or (v, u) in assigned_edges:
                            overlap_count += 1
                            
                    if path_is_blocked:
                        continue
                    
                    # Rational Assignment Cost with Overlap Penalty
                    scout_overlap_penalty = getattr(params, 'scout_overlap_penalty', 2500.0)
                    cost = (dist ** scout_exponent) - (ig_val * scout_ig_weight) + (overlap_count * scout_overlap_penalty)
                    
                    if cost < best_cost:
                        best_cost = cost
                        best_target = target_id
                        best_path = path
                        
                if best_target:
                    # Commit to Persistent Ledger
                    gmm.log_clearance(best_target)
                    gmm.danger_history[best_target] = belief_graph.nodes[best_target].get('p_danger', 0)
                    
                    targets_to_visit.append(best_target)
                    if best_path and len(best_path) > 1:
                        full_path.extend(best_path[1:])
                    # Add edges to set of assigned edges to disperse subsequent scouts
                    if best_path:
                        for i in range(len(best_path) - 1):
                            assigned_edges.add((best_path[i], best_path[i+1]))
                    available_targets.remove(best_target)
                    current_loc = best_target
                else:
                    break
                    
            if len(full_path) > 1:
                assignments.append({
                    "scout_id": scout.id,
                    "target_node_id": targets_to_visit[-1] if targets_to_visit else scout_loc,
                    "path": full_path[1:]
                })
                
        return assignments

    def assign_rescues(self, belief_graph: nx.Graph, idle_rescues: List[Any], weather_state: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Assigns idle rescue teams using GEVA."""
        if not idle_rescues:
            return []
            
        RESCUABLE_TYPES = {"POPULATION_ZONE", "BRIDGE", "JUNCTION"}
        targets = [
            n_id for n_id, data in belief_graph.nodes(data=True)
            if data.get('node_type') in RESCUABLE_TYPES
            and data.get('population', 0) > 0
            and data.get('p_danger', 0.0) > 0.05
        ]
        
        # Weather-driven sorting
        is_severe_weather = False
        if weather_state and (weather_state.get('rain_intensity', 0) > 80 or weather_state.get('storm_category', 0) >= 3):
            is_severe_weather = True
            
        def urgency_score(t: Any) -> float:
            base_urgency = belief_graph.nodes[t].get('population', 0) * belief_graph.nodes[t].get('p_danger', 0.0)
            if is_severe_weather and belief_graph.nodes[t].get('p_danger', 0.0) > 0.75:
                base_urgency *= 2.0  # Double urgency for high danger zones in severe weather
            return float(base_urgency)
            
        targets = sorted(targets, key=urgency_score, reverse=True)
        targets = targets[:200]

        
        # Convert rescue agents list to list of dicts for allocator
        idle_teams_dict = [
            {
                "id": r.id, 
                "current_node": r.current_node,
                "vehicle_type": getattr(r, 'vehicle_type', 'STANDARD_CAR')
            }
            for r in idle_rescues
        ]
        
        assignments = allocate_rescue_teams(belief_graph, idle_teams_dict, targets)
        return assignments
 
    def find_nearest_safe_haven(self, belief_graph: nx.Graph, source_node: str, needs_medical: bool = False, vehicle_type: str = "STANDARD_CAR") -> Optional[List[str]]:
        """Finds the path to the nearest shelter or hospital that is traversable and active."""
        if needs_medical:
            # Injured survivors requiring medical attention must be routed to an open, working hospital
            safe_havens = [
                n_id for n_id, data in belief_graph.nodes(data=True)
                if data.get('node_type') == "HOSPITAL"
                and data.get('status') not in ("BLOCKED", "COMPROMISED", "FLOODED")
            ]
        else:
            safe_havens = [
                n_id for n_id, data in belief_graph.nodes(data=True)
                if data.get('node_type') in ["SHELTER", "HOSPITAL"]
                and data.get('status') not in ("BLOCKED", "COMPROMISED", "FLOODED")
            ]
        
        havens_with_supplies: List[str] = []
        for haven_id in safe_havens:
            res = belief_graph.nodes[haven_id].get('resources', {})
            if res.get('food', 100) < 20.0 or res.get('water', 100) < 20.0:
                continue
            havens_with_supplies.append(haven_id)
            
        if not havens_with_supplies:
            havens_with_supplies = safe_havens
        
        best_path: Optional[List[str]] = None
        min_dist = float('inf')
        cost_cache: Dict[str, float] = {}
        
        for haven_id in havens_with_supplies:
            route_info = find_confidence_route(belief_graph, source_node, haven_id, vehicle_type, cost_cache)
            if route_info:
                path, dist, _ = route_info
                if dist < min_dist:
                    min_dist = dist
                    best_path = path
                    
        return best_path
