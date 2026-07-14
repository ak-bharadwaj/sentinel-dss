import networkx as nx  # type: ignore
from backend.config import settings

def compute_bayesian_update(p_prior: float, observation: str, eta: float = 0.9) -> float:
    """Computes Bayesian update on p_danger given a binary observation.
    observation: 'SAFE' or 'DANGER'
    eta: reliability/sensor correct rate (default = 0.9)
    """
    p = p_prior
    if observation == "SAFE":
        numerator = p * (1.0 - eta)
        denominator = p * (1.0 - eta) + (1.0 - p) * eta
    else:  # DANGER
        numerator = p * eta
        denominator = p * eta + (1.0 - p) * (1.0 - eta)
        
    # Prevent divide by zero or extreme confidence clamping
    if denominator == 0:
        return p
    return max(1e-4, min(1.0 - 1e-4, numerator / denominator))

def apply_scout_observation(belief_graph: nx.Graph, ground_truth_graph: nx.Graph, node_id: str) -> None:
    """Simulates a scout reaching a node, verifying the node and incident edges.
    Updates the BeliefGraph with GroundTruth details.
    """
    if node_id not in belief_graph:
        return
        
    # 1. Read ground truth state of the node
    gt_node = ground_truth_graph.nodes[node_id]
    gt_status = gt_node.get('status', 'SAFE')
    gt_danger = gt_node.get('p_danger', 0.0)
    
    # Update Node Belief
    prior_p = belief_graph.nodes[node_id].get('p_danger', 0.0)
    # Perform Bayesian update on the prior belief based on the ground truth observation
    updated_p = compute_bayesian_update(prior_p, gt_status, settings.OBSERVATION_RELIABILITY)
    
    belief_graph.nodes[node_id]['p_danger'] = updated_p
    belief_graph.nodes[node_id]['status'] = gt_status
    belief_graph.nodes[node_id]['p_state_correct'] = 1.0  # Reset confidence to 1.0 (verified)
    
    # 2. Verify all incident edges
    for neighbor in list(belief_graph.neighbors(node_id)):
        # Read true blocked state of this edge
        gt_edge_blocked = ground_truth_graph.edges[node_id, neighbor].get('blocked', False)
        
        # Update edge belief
        belief_graph.edges[node_id, neighbor]['blocked'] = gt_edge_blocked
        belief_graph.edges[node_id, neighbor]['confidence'] = 1.0
        
        # Partially verify neighbor node
        neigh_state = belief_graph.nodes[neighbor].get('p_state_correct', 1.0)
        belief_graph.nodes[neighbor]['p_state_correct'] = max(neigh_state, 0.8)
