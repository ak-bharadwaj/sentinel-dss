import numpy as np

class EdgeStateTensor:
    """Dynamic Edge-State Tensor (DEST) for high-performance vectorized operations.
    Keeps track of edge properties in aligned NumPy memory layouts.
    All calculations are modeling approximations.
    """
    def __init__(self, num_edges: int):
        self.num_edges = num_edges
        
        # Aligned memory layouts
        self.edge_ids = np.zeros(num_edges, dtype=np.int32)
        self.travel_time = np.zeros(num_edges, dtype=np.float32)
        self.water_depth = np.zeros(num_edges, dtype=np.float32)
        self.flow_velocity = np.zeros(num_edges, dtype=np.float32)
        self.confidence = np.ones(num_edges, dtype=np.float32)
        self.blocked = np.zeros(num_edges, dtype=np.uint8)
        self.vehicle_mask = np.ones((num_edges, 4), dtype=np.uint8)  # standard_car, zodiac, truck, helicopter
        
        # dynamic additions to capture dynamic congestion feedback loops
        self.edge_occupancy = np.zeros(num_edges, dtype=np.int32)
        self.congestion_factor = np.ones(num_edges, dtype=np.float32)
        self.last_updated_step = np.zeros(num_edges, dtype=np.int32)
        
        # Dynamic flow index lookup mappings
        self.edge_index_map = {}
        
    def sync_from_graph(self, graph, current_step: int = 0) -> None:
        """Populate the tensors from NetworkX graph properties."""
        self.edge_index_map.clear()
        for idx, (u, v, data) in enumerate(graph.edges(data=True)):
            e_id = data.get('id', f"{u}_{v}")
            self.edge_index_map[e_id] = idx
            self.edge_ids[idx] = hash(e_id) % 200000000
            self.travel_time[idx] = data.get('distance', 1.0) / 10.0
            self.water_depth[idx] = max(graph.nodes[u].get('water_level', 0.0), graph.nodes[v].get('water_level', 0.0))
            self.flow_velocity[idx] = 0.0
            self.confidence[idx] = data.get('confidence', 1.0)
            self.blocked[idx] = 1 if data.get('blocked', False) else 0
            
            # Populate dynamically tracked metadata properties
            self.edge_occupancy[idx] = data.get('current_flow', 0)
            self.congestion_factor[idx] = data.get('congestion_factor', 1.0)
            self.last_updated_step[idx] = current_step

    def update_edge(self, edge_id: str, water_depth: float, blocked: bool, confidence: float, current_step: int = 0) -> None:
        idx = self.edge_index_map.get(edge_id)
        if idx is not None:
            self.water_depth[idx] = water_depth
            self.blocked[idx] = 1 if blocked else 0
            self.confidence[idx] = confidence
            self.last_updated_step[idx] = current_step

