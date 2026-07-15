"""
Terrain Tensor
================
A NumPy-backed tensor that stores per-edge terrain properties.
Acts as the terrain layer of the full simulation tensor stack:

  Terrain Tensor   ← this module
       ↓
  Flood Tensor     (water_depth, flow_velocity)
       ↓
  Congestion Tensor (occupancy, congestion_factor)
       ↓
  Belief Tensor    (confidence, p_state_correct)
       ↓
  Routing Tensor   (cost per vehicle type)

All tensors share the same edge ordering via an `edge_index_map`.

Arrays:
  edge_elevation        [m]   — effective elevation (terrain + structural)
  edge_terrain_elev     [m]   — terrain elevation only (SRTM)
  edge_structural_offset[m]   — structural offset (bridge/tunnel/layer)
  edge_slope            [°]   — slope at edge midpoint
  edge_drainage         [-]   — Topographic Wetness Index (TWI)
  edge_surface          [0-4] — surface quality (4=excellent, 0=impassable)
  edge_bridge           [0/1] — 1 if the edge is a bridge
  edge_tunnel           [0/1] — 1 if the edge is a tunnel
  edge_accessibility    [0–1] — composite accessibility score
"""
from __future__ import annotations

import numpy as np
from typing import Dict, Any


# Surface quality codes (used for routing cost)
SURFACE_QUALITY: Dict[str, int] = {
    "paved": 4, "asphalt": 4, "concrete": 4,
    "sett": 3, "cobblestone": 3, "compacted": 3,
    "gravel": 2, "fine_gravel": 2, "dirt": 2, "sand": 2,
    "grass": 1, "mud": 1, "ground": 1, "earth": 1,
    "unpaved": 1, "unknown": 2,
}
_DEFAULT_SURFACE_QUALITY = 2


class TerrainTensor:
    """One tensor object — every disaster module consumes it."""

    def __init__(self, num_edges: int):
        self.num_edges = num_edges
        self.edge_index_map: Dict[str, int] = {}

        # Core terrain arrays
        self.edge_elevation = np.zeros(num_edges, dtype=np.float32)
        self.edge_terrain_elev = np.zeros(num_edges, dtype=np.float32)
        self.edge_structural_offset = np.zeros(num_edges, dtype=np.float32)
        self.edge_slope = np.zeros(num_edges, dtype=np.float32)
        self.edge_drainage = np.full(num_edges, 5.0, dtype=np.float32)  # neutral TWI
        self.edge_surface = np.full(num_edges, _DEFAULT_SURFACE_QUALITY, dtype=np.uint8)
        self.edge_bridge = np.zeros(num_edges, dtype=np.uint8)
        self.edge_tunnel = np.zeros(num_edges, dtype=np.uint8)
        self.edge_accessibility = np.ones(num_edges, dtype=np.float32)  # 1.0 = fully accessible

    def sync_from_graph(self, graph) -> None:
        """Populate terrain arrays from NetworkX graph edge/node attributes.
        Must be called after TerrainProcessor.enrich() so node terrain data is present.
        """
        self.edge_index_map.clear()
        for idx, (u, v, data) in enumerate(graph.edges(data=True)):
            if idx >= self.num_edges:
                break
            e_id = data.get("id", f"{u}_{v}")
            self.edge_index_map[e_id] = idx

            node_u = graph.nodes.get(u, {})
            node_v = graph.nodes.get(v, {})

            # Effective elevation = mean of both endpoint effective elevations
            elev_u = node_u.get("effective_elevation", node_u.get("elevation", 0.0))
            elev_v = node_v.get("effective_elevation", node_v.get("elevation", 0.0))
            self.edge_elevation[idx] = float((elev_u + elev_v) / 2.0)

            # Terrain-only elevation (no structural offset)
            terr_u = node_u.get("terrain_elevation", elev_u)
            terr_v = node_v.get("terrain_elevation", elev_v)
            self.edge_terrain_elev[idx] = float((terr_u + terr_v) / 2.0)

            # Structural offset
            off_u = node_u.get("structural_offset", 0.0)
            off_v = node_v.get("structural_offset", 0.0)
            self.edge_structural_offset[idx] = float((off_u + off_v) / 2.0)

            # Slope: use edge midpoint value if stored, otherwise average endpoints
            slope_u = node_u.get("slope", 0.0)
            slope_v = node_v.get("slope", 0.0)
            self.edge_slope[idx] = float((slope_u + slope_v) / 2.0)

            # Drainage TWI
            twi_u = node_u.get("twi", 5.0)
            twi_v = node_v.get("twi", 5.0)
            # Use max TWI (worst drainage = most flood risk)
            self.edge_drainage[idx] = float(max(twi_u, twi_v))

            # Surface quality
            surface_tag = data.get("surface", "unknown")
            self.edge_surface[idx] = SURFACE_QUALITY.get(surface_tag, _DEFAULT_SURFACE_QUALITY)

            # Bridge / tunnel flags
            self.edge_bridge[idx] = 1 if data.get("is_bridge", False) else 0
            self.edge_tunnel[idx] = 1 if data.get("is_tunnel", False) else 0

            # Accessibility score (composite)
            acc_u = node_u.get("accessibility_score", 1.0)
            acc_v = node_v.get("accessibility_score", 1.0)
            self.edge_accessibility[idx] = float(min(acc_u, acc_v))  # bottleneck

    # ------------------------------------------------------------------
    # Vectorised queries (used by flood/routing without graph lookups)
    # ------------------------------------------------------------------

    def flood_exposed_mask(self, water_depth_array: np.ndarray) -> np.ndarray:
        """Return boolean mask of edges where water exceeds effective elevation.
        
        Parameters
        ----------
        water_depth_array : np.ndarray shape (num_edges,)
            Mean water depth at each edge in metres.

        Returns
        -------
        np.ndarray bool shape (num_edges,)
            True where edge is flood-exposed (water above road surface).
        """
        return water_depth_array > self.edge_elevation

    def terrain_cost_array(self, vehicle_type: str = "STANDARD_CAR") -> np.ndarray:
        """Vectorised terrain routing cost multiplier for all edges.

        Returns an array of cost multipliers (≥ 1.0).
        """
        from backend.world_model.terrain.slope import slope_accessibility_multiplier
        slope_costs = np.array(
            [slope_accessibility_multiplier(float(s), vehicle_type) for s in self.edge_slope],
            dtype=np.float32
        )
        # Surface degradation: quality 4→1.0, quality 0→3.0
        surface_costs = 1.0 + (4 - self.edge_surface.astype(np.float32)) * 0.3

        if vehicle_type in ("HELICOPTER", "ZODIAC_BOAT"):
            return np.ones(self.num_edges, dtype=np.float32)

        return slope_costs * surface_costs

    def get_edge_idx(self, edge_id: str) -> int:
        """Return tensor index for a given edge ID, or -1 if not found."""
        return self.edge_index_map.get(edge_id, -1)
