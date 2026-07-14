import random
import networkx as nx  # type: ignore

def corrupt_belief_graph(ground_truth: nx.Graph, corruption_level: float) -> nx.Graph:
    """Implements Algorithm 15. Creates a corrupted copy of the GroundTruthGraph for coordinator belief.
    corruption_level: C in [0.0, 1.0] (e.g., 0.3, 0.6, 0.9)
    """
    belief = ground_truth.copy()
    
    # 1. Corrupt nodes
    nodes = list(belief.nodes)
    num_nodes_to_corrupt = int(len(nodes) * corruption_level)
    nodes_to_corrupt = set(random.sample(nodes, num_nodes_to_corrupt))
    
    for n_id in nodes:
        if n_id in nodes_to_corrupt:
            # Invert or randomize danger belief
            gt_danger = belief.nodes[n_id].get('p_danger', 0.0)
            belief.nodes[n_id]['p_danger'] = 1.0 - gt_danger
            belief.nodes[n_id]['p_state_correct'] = max(0.05, 1.0 - corruption_level)
            
            # Mismatch status
            if belief.nodes[n_id]['p_danger'] > 0.5:
                belief.nodes[n_id]['status'] = "DANGER"
            else:
                belief.nodes[n_id]['status'] = "SAFE"
        else:
            # Uncorrupted nodes start with full confidence
            belief.nodes[n_id]['p_state_correct'] = 1.0

    # 2. Corrupt edges
    edges = list(belief.edges)
    num_edges_to_corrupt = int(len(edges) * corruption_level)
    edges_to_corrupt = set(random.sample(edges, num_edges_to_corrupt))
    
    for u, v in belief.edges:
        # Determine if edge is near a safe haven
        u_node = belief.nodes[u]
        v_node = belief.nodes[v]
        is_near_haven = u_node.get('node_type') in ("HOSPITAL", "SHELTER") or v_node.get('node_type') in ("HOSPITAL", "SHELTER")

        if is_near_haven:
            # Safe havens and immediate adjacent roads are known
            belief.edges[u, v]['confidence'] = 1.0
        elif (u, v) in edges_to_corrupt or (v, u) in edges_to_corrupt:
            belief.edges[u, v]['confidence'] = 0.0
        else:
            belief.edges[u, v]['confidence'] = 1.0
            
    return belief
