import networkx as nx  # type: ignore
from backend.agents.fleet_config import get_effective_speed
from typing import Optional, Tuple, List, Dict, Any

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
    
    # Average danger for helicopter flight constraints
    p_danger_edge = (node_u.get('p_danger', 0.0) + node_v.get('p_danger', 0.0)) / 2.0
    
    # 2. Check speed traversability using fleet config helper
    eff_speed = get_effective_speed(vehicle_type, 10.0, water_level, is_blocked, disaster_type=disaster_type, p_danger=p_danger_edge)
    if eff_speed <= 0.0:
        return 1e9  # impassable
        
    distance = edge_data.get('distance', 1.0)
    
    # Helicopters fly directly over everything
    if vehicle_type == "HELICOPTER":
        return distance / 2.5
        
    speed_factor = edge_data.get('speed_factor', 1.0)
        
    # Calculate travel-time cost equivalent
    effective_speed_factor = (eff_speed / 10.0) * speed_factor
    time_cost = distance / max(0.01, effective_speed_factor)
    
    p_danger_edge = (node_u.get('p_danger', 0.0) + node_v.get('p_danger', 0.0)) / 2.0
    confidence_edge = (node_u.get('p_state_correct', 1.0) + node_v.get('p_state_correct', 1.0)) / 2.0
    
    from backend.simulation.engine import simulation_engine
    is_safe_route = getattr(simulation_engine, 'safe_route_mode', False)
    risk_multiplier = 500.0 if is_safe_route else 100.0
    
    risk_penalty = risk_multiplier * p_danger_edge
    uncertainty_penalty = 100.0 * (1.0 - confidence_edge)
    
    return time_cost + risk_penalty + uncertainty_penalty

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
