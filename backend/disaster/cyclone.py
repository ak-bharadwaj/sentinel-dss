import math
import networkx as nx

class CycloneModule(object):
    def __init__(self, wind_speed: float = 120.0):
        self.wind_speed = wind_speed # Base wind speed in km/h
        self.eye_lat = None
        self.eye_lon = None

    def generate_prior(self, graph: nx.Graph) -> None:
        """Assign cyclone hazard priors based on coastal proximity."""
        # Cyclone threat comes from the coast (storm surge + direct wind impact)
        max_dist = 1.0
        
        # Calculate max coastal distance to normalize
        distances = []
        for n_id, data in graph.nodes(data=True):
            d = data.get('dist_to_coast')
            if d is None:
                d = 999999.0
            if d < 100000.0:
                distances.append(d)
                
        if distances:
            max_dist = max(distances)
            
        for n_id, data in graph.nodes(data=True):
            dist_to_coast = data.get('dist_to_coast')
            if dist_to_coast is None:
                dist_to_coast = 999999.0
            
            if dist_to_coast > 100000.0:
                # If synthetic or no coast, assume generic flat risk
                coast_risk = 0.5
            else:
                coast_risk = 1.0 - (dist_to_coast / max(1.0, max_dist))
                
            # Storm surge (coast) + wind (base)
            cyclone_risk = 0.6 * coast_risk + 0.4 * (self.wind_speed / 200.0)
            p_danger = max(0.05, min(0.95, cyclone_risk))
            
            graph.nodes[n_id]['p_danger'] = p_danger
            if p_danger > 0.85:
                graph.nodes[n_id]['status'] = "DANGER"
            else:
                graph.nodes[n_id]['status'] = "SAFE"

    def update_simulation_step(self, graph: nx.Graph, step: int) -> list:
        newly_blocked_edges = []
        
        import random
        random.seed(step)
        
        # Wind gusts randomly tear off roofs or drop trees (blocking roads)
        gust_chance = self.wind_speed / 1000.0
        
        for n_id, data in graph.nodes(data=True):
            lat = data.get('y', data.get('lat'))
            lon = data.get('x', data.get('lon'))
            if lat is None or lon is None:
                continue
                
            current_danger = data.get('p_danger', 0.0)
            
            # Chance of sudden local wind gust causing damage
            if random.random() < gust_chance * current_danger:
                # Damage structure
                next_danger = min(1.0, current_danger + 0.1)
                data['p_danger'] = next_danger
                
                # Severe structural damage causes road blockages from debris
                if next_danger > 0.90 and data.get('status') != "DANGER" and data.get('node_type') not in ("HOSPITAL", "SHELTER"):
                    data['status'] = "DANGER"
                    
                    for neighbor in list(graph.neighbors(n_id)):
                        if not graph.has_edge(n_id, neighbor):
                            continue
                        if not graph.edges[n_id, neighbor].get('blocked', False):
                            graph.edges[n_id, neighbor]['blocked'] = True
                            graph.edges[n_id, neighbor]['confidence'] = 1.0
                            newly_blocked_edges.append((n_id, neighbor))
                            
        return newly_blocked_edges
