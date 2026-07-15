import networkx as nx  # type: ignore
from backend.config import settings
from backend.belief.sensor_model import (
    ObservationContext, evaluate_observation_quality, SENSOR_MAX_RANGE_M, MIN_ETA
)
from backend.world_model.graph_builder import haversine_distance

def compute_bayesian_update(p_prior: float, observation: str, eta: float) -> float:
    """Computes Bayesian update on p_danger given a binary observation.
    observation: 'SAFE' or 'DANGER'
    """
    p = p_prior
    if observation == "SAFE":
        numerator = p * (1.0 - eta)
        denominator = p * (1.0 - eta) + (1.0 - p) * eta
    else:  # DANGER
        numerator = p * eta
        denominator = p * eta + (1.0 - p) * (1.0 - eta)
        
    if denominator == 0:
        return p
    return max(1e-4, min(1.0 - 1e-4, numerator / denominator))

def apply_scout_observation(
    belief_graph: nx.Graph,
    ground_truth_graph: nx.Graph,
    node_id: str,
    sensor_type: str = "HUMAN_VISUAL",
    age_minutes: float = 0.0,
    visibility_km: float = 10.0,
    wind_speed_kmh: float = 0.0,
    smoke_present: bool = False
) -> None:
    """Simulates a scout reaching a node, verifying the node and incident edges.
    Updates the BeliefGraph using the rich sensor model.
    """
    if node_id not in belief_graph:
        return
        
    # 1. Read ground truth state of the node
    gt_node = ground_truth_graph.nodes[node_id]
    gt_status = gt_node.get('status', 'SAFE')
    
    # 2. Build observation context and compute quality metrics
    context = ObservationContext(
        sensor_type=sensor_type,
        age_minutes=age_minutes,
        visibility_km=visibility_km,
        distance_m=0.0,  # At the node
        disaster_type=getattr(settings, "DISASTER_TYPE", "FLOOD"),
        wind_speed_kmh=wind_speed_khm if 'wind_speed_khm' in locals() else wind_speed_kmh,
        smoke_present=smoke_present
    )
    quality = evaluate_observation_quality(context)
    
    # Update Node Belief
    prior_p = belief_graph.nodes[node_id].get('p_danger', 0.0)
    updated_p = compute_bayesian_update(prior_p, gt_status, quality.eta)
    
    belief_graph.nodes[node_id]['p_danger'] = updated_p
    belief_graph.nodes[node_id]['status'] = gt_status
    # Node confidence ceiling bounded by sensor capability
    belief_graph.nodes[node_id]['p_state_correct'] = quality.eta
    
    # 3. Verify all incident edges and update neighbors using visibility range-based decay
    lat_u = belief_graph.nodes[node_id].get('lat', 0.0)
    lon_u = belief_graph.nodes[node_id].get('lon', 0.0)
    max_range = SENSOR_MAX_RANGE_M.get(sensor_type, 100.0)
    
    for neighbor in list(belief_graph.neighbors(node_id)):
        # Read true blocked state of this edge
        gt_edge_blocked = ground_truth_graph.edges[node_id, neighbor].get('blocked', False)
        
        # Update edge belief
        belief_graph.edges[node_id, neighbor]['blocked'] = gt_edge_blocked
        belief_graph.edges[node_id, neighbor]['confidence'] = quality.eta
        
        # Partially verify neighbor node based on distance, visibility and LOS modeling assumptions
        lat_v = belief_graph.nodes[neighbor].get('lat', 0.0)
        lon_v = belief_graph.nodes[neighbor].get('lon', 0.0)
        dist_m = haversine_distance(lat_u, lon_u, lat_v, lon_v)
        
        if dist_m <= max_range:
            range_ratio = math.exp(-dist_m / max_range)
            # Fetch visibility and LOS parameters
            edge_visibility = belief_graph.edges[node_id, neighbor].get('visibility_factor', 1.0)
            line_of_sight = 1.0 if belief_graph.edges[node_id, neighbor].get('has_los', True) else 0.3
            
            # Combine range decay, edge visibility and LOS multipliers
            gain = range_ratio * edge_visibility * line_of_sight * 0.85
            neigh_state = belief_graph.nodes[neighbor].get('p_state_correct', 0.5)
            belief_graph.nodes[neighbor]['p_state_correct'] = max(neigh_state, gain)

