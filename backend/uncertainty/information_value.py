import networkx as nx  # type: ignore
import math
from typing import Dict, Any

def compute_global_iv(belief_graph: nx.Graph) -> Dict[Any, float]:
    """Computes GlobalIV for all nodes in the belief graph.
    Formula: GlobalIV = 0.40 * H_norm + 0.30 * Pop_norm + 0.30 * Importance
    """
    entropies = {}
    populations = {}
    importances = {}
    
    for n_id, data in belief_graph.nodes(data=True):
        # Read or default danger probability
        p_danger = data.get('p_danger', 0.0)
        
        # Calculate entropy H
        H = calculate_entropy(p_danger)
        entropies[n_id] = H
        
        populations[n_id] = float(data.get('population', 0))
        importances[n_id] = float(data.get('importance', 0.0))
        
    max_entropy = max(entropies.values()) if entropies else 1.0
    max_pop = max(populations.values()) if populations else 1.0
    
    global_iv = {}
    for n_id in belief_graph.nodes:
        H_norm = (entropies[n_id] / max_entropy) if max_entropy > 0 else 0.0
        Pop_norm = (populations[n_id] / max_pop) if max_pop > 0 else 0.0
        importance = importances[n_id]
        
        iv = 0.40 * H_norm + 0.30 * Pop_norm + 0.30 * importance
        global_iv[n_id] = iv
        
    return global_iv

def calculate_entropy(p: float) -> float:
    p = max(1e-9, min(1.0 - 1e-9, p))
    return -p * math.log2(p) - (1.0 - p) * math.log2(1.0 - p)
