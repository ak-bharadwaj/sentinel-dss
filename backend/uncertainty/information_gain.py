import networkx as nx  # type: ignore
import math
from typing import Dict, Any
from backend.uncertainty.information_value import compute_global_iv

def compute_global_ig(belief_graph: nx.Graph) -> Dict[Any, float]:
    """Computes GlobalIG for all nodes in the belief graph.
    Formula: GlobalIG(v) = GlobalIV(v) + 0.25 * NU(v)
    where NU(v) is the average entropy of the neighbors of v.
    """
    global_iv = compute_global_iv(belief_graph)
    global_ig = {}
    
    # Precompute entropies for neighbors
    entropies = {}
    for n_id, data in belief_graph.nodes(data=True):
        p_danger = data.get('p_danger', 0.0)
        entropies[n_id] = calculate_entropy(p_danger)
        
    for v in belief_graph.nodes:
        # Neighbors of v
        neighbors = list(belief_graph.neighbors(v))
        if not neighbors:
            NU = 0.0
        else:
            NU = sum(entropies[w] for w in neighbors) / len(neighbors)
            
        global_ig[v] = global_iv[v] + 0.25 * NU
        
    return global_ig

def calculate_entropy(p: float) -> float:
    p = max(1e-9, min(1.0 - 1e-9, p))
    return -p * math.log2(p) - (1.0 - p) * math.log2(1.0 - p)
