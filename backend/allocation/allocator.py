import networkx as nx
from backend.routing.confidence_dijkstra import find_confidence_route
from backend.allocation.geva import calculate_ev, get_vulnerability_multiplier
from backend.config import settings
from backend.world_model.global_memory import gmm

def compute_reachability(graph: nx.Graph, path: list) -> float:
    """Reachability is the product of edge confidences along the route."""
    if not path or len(path) < 2:
        return 1.0
        
    reachability = 1.0
    for i in range(len(path) - 1):
        u, v = path[i], path[i+1]
        confidence = graph.edges[u, v].get('confidence', 1.0)
        reachability *= confidence
        
    return reachability

def allocate_rescue_teams(belief_graph: nx.Graph, idle_teams: list, target_nodes: list) -> list:
        
    assignments = []
    available_targets = list(target_nodes)  # Copy targets list
    
    # Sort teams to make assignment deterministic
    teams = sorted(idle_teams, key=lambda t: t['id'])
    
    # Track edges assigned to teams in this allocation cycle to penalize overlapping routes
    assigned_edges = set()
    
    for team in teams:
        if not available_targets:
            break
            
        best_ev = -999999.0
        best_target = None
        best_path = None
        best_dist = 0.0
        
        team_loc = team['current_node']
        vehicle_type = team.get('vehicle_type', 'STANDARD_CAR')
        weight_key = f'cost_{vehicle_type}'
            
        import numpy as np
        try:
            dist_matrix, _ = gmm.calculate_distance_matrix(vehicle_type, [team_loc])
            if dist_matrix is not None:
                row_dists = dist_matrix[0]
                lengths = {gmm.node_list[i]: float(d) for i, d in enumerate(row_dists) if not np.isinf(d)}
            else:
                lengths = nx.single_source_dijkstra_path_length(belief_graph, team_loc, weight=weight_key)
        except Exception:
            lengths = {}
            
        candidate_targets = []
        for target_id in available_targets:
            target_data = belief_graph.nodes[target_id]
            pop = target_data.get('population', 0)
            p_danger = target_data.get('p_danger', 0.0)
            is_coastal = target_data.get('is_coastal', False)
            
            # Swarm Capacity Check via GMM
            remaining_demand = gmm.get_remaining_demand(target_id, pop)
            
            if remaining_demand > 0 and p_danger > 0.05 and not is_coastal and target_id in lengths:
                candidate_targets.append((target_id, lengths[target_id]))
                
        # Only evaluate exact paths for the 20 closest targets
        candidate_targets.sort(key=lambda x: x[1])
        top_candidates = candidate_targets[:20]
        
        for target_id, dist in top_candidates:
            target_data = belief_graph.nodes[target_id]
            pop = target_data.get('population', 0)
            p_danger = target_data.get('p_danger', 0.0)
            
            try:
                path = nx.shortest_path(belief_graph, team_loc, target_id, weight=weight_key)
            except Exception:
                continue
            
            # Compute reachability
            reachability = compute_reachability(belief_graph, path)
            
            # Travel time in minutes
            t_arrival = 0.0
            overlap_count = 0
            
            from backend.agents.fleet_config import get_effective_speed
            eff_s = get_effective_speed(team.get('vehicle_type', 'STANDARD_CAR'), settings.RESCUE_SPEED, 0.0, False)
            
            for i in range(len(path) - 1):
                u, v = path[i], path[i+1]
                edge_data = belief_graph.edges[u, v]
                d = edge_data.get('distance', 1.0)
                sf = edge_data.get('speed_factor', 1.0)
                eff = eff_s * sf
                if eff <= 0.0 or edge_data.get('blocked', False):
                    t_arrival += 999999.0
                else:
                    t_arrival += (d / eff) / 60.0
                if (u, v) in assigned_edges or (v, u) in assigned_edges:
                    overlap_count += 1
            
            vulnerability_multiplier = get_vulnerability_multiplier(target_data)
            ev = calculate_ev(p_danger, pop, reachability, t_arrival, vulnerability_multiplier)
            ev -= (overlap_count * 8.0)
            
            if ev > best_ev:
                best_ev = ev
                best_target = target_id
                best_dist = dist
                best_path = path
                
        # Assign if we found a valid route and target with reasonable EV
        if best_target and best_ev > -9999.0:
            assignments.append({
                "team_id": team['id'],
                "target_node_id": best_target,
                "path": best_path,
                "distance": best_dist,
                "ev": best_ev
            })
            for i in range(len(best_path) - 1):
                assigned_edges.add((best_path[i], best_path[i+1]))
                
            # Log inbound capacity to the GMM
            vehicle_cap = 50 if vehicle_type == "AMBULANCE" else 100 # Default fallback
            gmm.allocate_capacity(best_target, vehicle_cap)
            
            target_data = belief_graph.nodes[best_target]
            pop = target_data.get('population', 0)
            if gmm.get_remaining_demand(best_target, pop) <= 0:
                available_targets.remove(best_target)
            
    return assignments
