import math
import networkx as nx
from backend.world_model.graph_builder import FAULT_LINE, calculate_distance_to_line_segment, generate_noise

class EarthquakeModule(object):
    def __init__(self, epicenter_lat=None, epicenter_lon=None):
        self.epicenter_lat = epicenter_lat
        self.epicenter_lon = epicenter_lon

    def generate_prior(self, graph: nx.Graph) -> None:
        distances = {}
        soils = {}
        
        # 1. Synthetically compute attributes
        for n_id, data in graph.nodes(data=True):
            lat = data['lat']
            lon = data['lon']
            
            # Distance to fault line
            dist_to_fault = calculate_distance_to_line_segment(lat, lon, FAULT_LINE[0], FAULT_LINE[1])
            distances[n_id] = dist_to_fault
            
            # Soil amplification in [0.2, 1.0] using generate_noise
            soils[n_id] = 0.2 + 0.8 * generate_noise(lat, lon, 150.0)

        max_fault_dist = max(distances.values()) if distances else 1.0
        
        # 2. Compute risk for each node
        for n_id, data in graph.nodes(data=True):
            dist = distances[n_id]
            soil = soils[n_id]
            
            # Building vulnerability mapping
            node_type = data.get('node_type', 'ROAD')
            if node_type == "HOSPITAL":
                vulnerability = 0.1
            elif node_type == "SHELTER":
                vulnerability = 0.1
            elif node_type == "POPULATION_ZONE":
                vulnerability = 0.6
            elif node_type == "BRIDGE":
                vulnerability = 0.5
            else:  # ROAD or JUNCTION
                vulnerability = 0.2
                
            if data.get("is_tall_building_zone", False):
                vulnerability = min(1.0, vulnerability * 1.5)
                
            fault_proximity = 1.0 - (dist / max_fault_dist)
            
            risk = 0.5 * vulnerability + 0.3 * fault_proximity + 0.2 * soil
            p_danger = max(0.05, min(0.95, risk))
            
            graph.nodes[n_id]['p_danger'] = p_danger
            if p_danger > 0.8:
                graph.nodes[n_id]['status'] = "DANGER"
            else:
                graph.nodes[n_id]['status'] = "SAFE"

    def update_simulation_step(self, graph: nx.Graph, step: int) -> list:
        newly_blocked_edges = []
        
        # If no epicenter is set, select the midpoint of the fault line
        if not self.epicenter_lat or not self.epicenter_lon:
            self.epicenter_lat = (FAULT_LINE[0][0] + FAULT_LINE[1][0]) / 2.0
            self.epicenter_lon = (FAULT_LINE[0][1] + FAULT_LINE[1][1]) / 2.0
            
        # The seismic aftershock front expands by 0.004 degrees (~400m) per step
        shockwave_radius = 0.003 + (step * 0.004)
        
        for n_id, data in graph.nodes(data=True):
            lat = data.get('y', data.get('lat'))
            lon = data.get('x', data.get('lon'))
            if lat is None or lon is None:
                continue
                
            dist_to_epicenter = math.hypot(lat - self.epicenter_lat, lon - self.epicenter_lon)
            
            # If hit by expanding shockwave front
            if dist_to_epicenter <= shockwave_radius:
                vulnerability = 0.2
                ntype = data.get('node_type', 'ROAD')
                if ntype == "BRIDGE":
                    vulnerability = 0.8
                elif ntype == "POPULATION_ZONE":
                    vulnerability = 0.6
                    
                if data.get("is_tall_building_zone", False):
                    vulnerability = min(1.0, vulnerability * 1.5)
                    
                # Shockwave intensity decays with distance
                intensity = max(0.1, 1.0 - (dist_to_epicenter / (shockwave_radius + 0.01)))
                structural_damage = vulnerability * intensity * 0.5
                
                current_danger = data.get('p_danger', 0.0)
                next_danger = min(1.0, current_danger + structural_damage)
                data['p_danger'] = next_danger
                
                # Structural collapse threshold
                if next_danger > 0.88 and data.get('status') != "DANGER" and data.get('node_type') not in ("HOSPITAL", "SHELTER"):
                    data['status'] = "DANGER"
                    for neighbor in list(graph.neighbors(n_id)):
                        if not graph.has_edge(n_id, neighbor):
                            continue
                        if not graph.edges[n_id, neighbor].get('blocked', False):
                            graph.edges[n_id, neighbor]['blocked'] = True
                            graph.edges[n_id, neighbor]['confidence'] = 1.0
                            newly_blocked_edges.append((n_id, neighbor))
                            
        return newly_blocked_edges
