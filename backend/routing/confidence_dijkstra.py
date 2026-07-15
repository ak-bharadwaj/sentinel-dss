import networkx as nx  # type: ignore
from backend.agents.fleet_config import get_effective_speed
from typing import Optional, Tuple, List, Dict, Any
from backend.routing.cost_config import WEIGHTS, SAFE_ROUTE_MULTIPLIER, REFERENCE_TIME_S
from backend.routing.helicopter_model import helicopter_edge_cost

def get_vehicle_risk(node_data: dict, vehicle_type: str) -> float:
    """Extract vehicle-specific hazard danger probabilities from separate hazard layers."""
    # Projection matrix representation mapping vehicle index to relevant hazards
    # Boat cares only about structural, Helicopter cares about fire/wind, Cars care about flood/structural
    if vehicle_type == "ZODIAC_BOAT":
        return node_data.get('p_structural', node_data.get('p_danger', 0.0))
    elif vehicle_type == "HIGH_WATER_TRUCK":
        return node_data.get('p_structural', node_data.get('p_danger', 0.0))
    elif vehicle_type == "HELICOPTER":
        return max(node_data.get('p_fire', 0.0), node_data.get('p_wind', 0.0))
    else:  # STANDARD_CAR
        return max(node_data.get('p_flood', node_data.get('p_danger', 0.0)),
                   node_data.get('p_structural', node_data.get('p_danger', 0.0)))

def calculate_edge_cost(graph: nx.Graph, u: str, v: str, edge_data: Dict[str, Any], vehicle_type: str = "STANDARD_CAR", disaster_type: str = "FLOOD") -> float:
    node_u = graph.nodes[u]
    node_v = graph.nodes[v]

    # 1. Endpoints status check
    if node_u.get('status') == 'BLOCKED' or node_v.get('status') == 'BLOCKED':
        if vehicle_type != "HELICOPTER":
            return 1e9

    # Retrieve water levels
    wl_u = node_u.get('water_level', 0.0)
    wl_v = node_v.get('water_level', 0.0)
    water_level = max(wl_u, wl_v)
    is_blocked = edge_data.get('blocked', False)
    
    distance = edge_data.get('distance', 1.0)
    
    # Helicopters fly directly over everything using custom operational bounds
    if vehicle_type == "HELICOPTER":
        from backend.simulation.engine import simulation_engine
        w_data = getattr(simulation_engine, 'weather', None)
        return helicopter_edge_cost(distance, node_u, node_v, w_data)
        
    p_danger_edge = (get_vehicle_risk(node_u, vehicle_type) + get_vehicle_risk(node_v, vehicle_type)) / 2.0
    
    # 2. Check speed traversability using fleet config helper
    eff_speed = get_effective_speed(vehicle_type, 10.0, water_level, is_blocked, disaster_type=disaster_type, p_danger=p_danger_edge)
    if eff_speed <= 0.0:
        return 1e9  # impassable
        
    speed_factor = edge_data.get('speed_factor', 1.0)
        
    # Calculate travel-time cost equivalent
    effective_speed_factor = (eff_speed / 10.0) * speed_factor
    time_cost_raw = distance / max(0.01, effective_speed_factor)
    time_cost_norm = time_cost_raw / REFERENCE_TIME_S
    
    confidence_edge = (node_u.get('p_state_correct', 1.0) + node_v.get('p_state_correct', 1.0)) / 2.0
    
    from backend.simulation.engine import simulation_engine
    is_safe_route = getattr(simulation_engine, 'safe_route_mode', False)
    risk_mult = SAFE_ROUTE_MULTIPLIER if is_safe_route else 1.0

    risk_penalty = WEIGHTS["w_risk"] * p_danger_edge * risk_mult
    uncertainty_penalty = WEIGHTS["w_uncertainty"] * (1.0 - confidence_edge)

    # Terrain cost — slope + surface quality, vehicle-aware
    terrain_penalty = 0.0
    if vehicle_type not in ("HELICOPTER", "ZODIAC_BOAT"):
        slope_u = node_u.get("slope", 0.0)
        slope_v = node_v.get("slope", 0.0)
        avg_slope = (slope_u + slope_v) / 2.0
        from backend.world_model.terrain.slope import slope_accessibility_multiplier
        slope_mult = slope_accessibility_multiplier(avg_slope, vehicle_type)
        # Accessibility score: lower score → higher cost
        acc_u = node_u.get("accessibility_score", 1.0)
        acc_v = node_v.get("accessibility_score", 1.0)
        terrain_penalty = WEIGHTS.get("w_terrain", 0.8) * (slope_mult - 1.0) * (1.0 - min(acc_u, acc_v))

    return time_cost_norm + risk_penalty + uncertainty_penalty + terrain_penalty


def update_grid_edge_costs(graph: nx.Graph) -> None:
    """Fallback cache update (kept for interface compatibility)."""
    for u, v, data in graph.edges(data=True):
        data['cost'] = calculate_edge_cost(graph, u, v, data)

def find_confidence_route(graph: nx.Graph, source: str, target: str, vehicle_type: str = "STANDARD_CAR", cost_cache: Optional[Dict[str, Any]] = None) -> Optional[Tuple[List[str], float, float]]:
    """Finds the safest reliable route using Dijkstra with dynamic edge cost weights based on fleet capabilities.
    Returns: (path_list, total_distance, average_confidence) or None.
    """
    weight_key = f'cost_{vehicle_type}'
    try:
        path = nx.shortest_path(
            graph, 
            source=source, 
            target=target, 
            weight=weight_key
        )
        
        # Calculate statistics
        total_distance = 0.0
        confidences = []
        for i in range(len(path) - 1):
            u, v = path[i], path[i+1]
            edge_data = graph.edges[u, v]
            total_distance += edge_data.get('distance', 0.0)
            
            node_u = graph.nodes[u]
            node_v = graph.nodes[v]
            conf = (node_u.get('p_state_correct', 1.0) + node_v.get('p_state_correct', 1.0)) / 2.0
            confidences.append(conf)
            
        avg_confidence = sum(confidences) / len(confidences) if confidences else 1.0
        return path, total_distance, avg_confidence
        
    except nx.NetworkXNoPath:
        return None
    except nx.NodeNotFound:
        return None
