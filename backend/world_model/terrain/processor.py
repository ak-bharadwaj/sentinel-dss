"""
Terrain Processor — Orchestrator
===================================
Runs ONCE when a region is imported. Never during simulation.
Enriches every node and edge in the graph with:

  node attributes added:
    terrain_elevation    — SRTM elevation in metres
    structural_offset    — height above terrain from OSM structure tags
    effective_elevation  — terrain_elevation + structural_offset
    slope                — degrees from horizontal
    aspect               — downslope compass bearing (°)
    twi                  — Topographic Wetness Index
    terrain_class        — PEAK / CREST / SLOPE / VALLEY / BASIN
    vs30_terrain         — Vs30 seismic proxy from terrain class + elevation
    accessibility_score  — composite [0, 1] score for route planning

  edge attributes added:
    elevation_offset     — structural_offset of the edge (max of endpoints)
    is_tunnel            — True if the edge is underground

Pipeline:
  1. Check persistent terrain_cache for existing data for this region.
  2. If cache hit → restore from DB (instant).
  3. If cache miss → fetch from TerrainProviderFactory (cascade of providers).
  4. Compute slope, aspect, TWI, terrain class, Vs30, accessibility.
  5. Attach all attributes to graph nodes/edges.
  6. Persist to terrain_cache.
"""
from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Tuple

import networkx as nx

from backend.world_model.terrain.provider import TerrainProviderFactory
from backend.world_model.terrain.slope import compute_slope_degrees, slope_accessibility_multiplier
from backend.world_model.terrain.drainage import compute_twi, twi_to_accumulation_rate, classify_drainage
from backend.world_model.terrain.structural_offsets import compute_structural_offset, compute_bridge_amplification_factor
from backend.world_model.terrain.terrain_cache import terrain_cache

# ---------------------------------------------------------------------------
# Vs30 classification from terrain class + elevation
# Matches NEHRP site class definitions
# ---------------------------------------------------------------------------
_TERRAIN_VS30: Dict[str, float] = {
    "PEAK":   600.0,   # rock — Class B
    "CREST":  450.0,   # stiff soil / weathered rock — Class C
    "SLOPE":  300.0,   # medium stiff soil — Class C/D
    "VALLEY": 200.0,   # soft alluvial soil — Class D/E
    "BASIN":  150.0,   # very soft sediment / potential liquefaction — Class E
}

# Additional Vs30 correction for elevation (low-lying land is softer)
def _vs30_from_terrain(terrain_class: str, elevation: float) -> float:
    base = _TERRAIN_VS30.get(terrain_class, 300.0)
    # Low-elevation reclaimed/coastal land → amplify softness
    if elevation < 3.0:
        base = min(base, 180.0)  # Class E
    elif elevation < 8.0:
        base = min(base, 220.0)  # Class D/E boundary
    return base


# ---------------------------------------------------------------------------
# Terrain accessibility score
# ---------------------------------------------------------------------------
def _compute_accessibility(
    effective_elevation: float,
    slope_deg: float,
    twi: float,
    is_bridge: bool,
    is_coastal: bool,
    node_type: str,
) -> float:
    """Composite accessibility score in [0, 1].
    
    1.0 = fully accessible (flat, paved, elevated above water risk)
    0.0 = inaccessible
    """
    score = 1.0

    # Slope penalty: cars struggle above 15°
    if slope_deg > 35:
        score *= 0.1
    elif slope_deg > 20:
        score *= 0.4
    elif slope_deg > 10:
        score *= 0.7

    # Low elevation in flood-prone area → drainage risk
    if effective_elevation < 2.0:
        score *= 0.7
    elif effective_elevation < 5.0:
        score *= 0.85

    # High TWI = water pools here = harder to access during flood
    if twi > 10.0:
        score *= 0.6
    elif twi > 7.0:
        score *= 0.8

    # Bridges are structurally well-defined but elevated risk during earthquake
    if is_bridge:
        score *= 0.95

    # Coastal nodes have surge risk
    if is_coastal:
        score *= 0.85

    return max(0.05, min(1.0, score))


# ---------------------------------------------------------------------------
# Main TerrainProcessor class
# ---------------------------------------------------------------------------
class TerrainProcessor:
    """Enriches a NetworkX graph with terrain intelligence.
    
    Run once per region. Never per simulation step.
    
    Usage:
        processor = TerrainProcessor()
        processor.enrich(graph, osm_tags_map=tags)
    """

    def __init__(self, force_refresh: bool = False):
        """
        Parameters
        ----------
        force_refresh : bool
            If True, ignore cache and re-fetch from provider.
        """
        self.force_refresh = force_refresh
        terrain_cache.init()

    def enrich(
        self,
        graph: nx.Graph,
        osm_tags_map: Optional[Dict[str, Dict[str, Any]]] = None,
    ) -> None:
        """Main entry point. Enriches all nodes and edges in the graph.

        Parameters
        ----------
        graph : nx.Graph
            The world model graph (ground_truth or belief).
        osm_tags_map : dict, optional
            Maps node_id → OSM tag dict. Used for structural offset computation.
            If None, structural offsets are estimated from node attributes.
        """
        if osm_tags_map is None:
            osm_tags_map = {}

        nodes = list(graph.nodes(data=True))
        if not nodes:
            return

        # --- 1. Collect coordinates ---
        node_ids = [n_id for n_id, _ in nodes]
        lat_lons = [
            (data.get("lat", data.get("y", 0.0)), data.get("lon", data.get("x", 0.0)))
            for _, data in nodes
        ]

        # --- 2. Determine bounding box for cache check ---
        lats = [ll[0] for ll in lat_lons]
        lons = [ll[1] for ll in lat_lons]
        min_lat, max_lat = min(lats), max(lats)
        min_lon, max_lon = min(lons), max(lons)

        # --- 3. Load from cache or fetch from provider ---
        cached_data: Dict[str, dict] = {}
        if not self.force_refresh:
            cached_data = terrain_cache.load_region(min_lat, max_lat, min_lon, max_lon)

        # Find nodes not in cache
        missing_ids = [n_id for n_id in node_ids if n_id not in cached_data]

        if missing_ids:
            print(f"[TerrainProcessor] Fetching elevation for {len(missing_ids)} nodes "
                  f"(cache hit: {len(cached_data)})…")
            missing_pairs = [
                (data.get("lat", data.get("y", 0.0)), data.get("lon", data.get("x", 0.0)))
                for n_id, data in nodes if n_id in missing_ids
            ]
            # Deduplicate lat/lon pairs before fetching
            unique_pairs = list(dict.fromkeys(missing_pairs))
            elevation_map = TerrainProviderFactory.resolve_batch(unique_pairs)
        else:
            print(f"[TerrainProcessor] Full cache hit for {len(cached_data)} nodes — skipping API call.")
            elevation_map = {}

        # --- 4. Build per-node terrain data ---
        to_persist: List[dict] = []

        for n_id, data in nodes:
            lat = data.get("lat", data.get("y", 0.0))
            lon = data.get("lon", data.get("x", 0.0))
            lat_key = (round(lat, 4), round(lon, 4))

            # Terrain elevation
            if n_id in cached_data:
                cache_row = cached_data[n_id]
                terrain_elev = cache_row["elevation"]
                slope_deg = cache_row["slope"]
                aspect_deg = cache_row["aspect"]
                twi = cache_row["twi"]
                terrain_class = cache_row["terrain_class"]
                source = cache_row["source"]
            else:
                terrain_elev = elevation_map.get(lat_key, 0.0)
                slope_deg, aspect_deg = compute_slope_degrees(lat, lon, elevation_map)
                twi = compute_twi(slope_deg)
                terrain_class = classify_drainage(twi)
                source = "fetched"

                to_persist.append({
                    "node_id": str(n_id),
                    "lat": lat,
                    "lon": lon,
                    "elevation": terrain_elev,
                    "slope": slope_deg,
                    "aspect": aspect_deg,
                    "twi": twi,
                    "terrain_class": terrain_class,
                    "source": source,
                })

            # Structural offset from OSM tags
            tags = osm_tags_map.get(str(n_id), {})
            # Supplement with graph attributes
            if not tags:
                if data.get("is_bridge"):
                    tags = {"bridge": "yes", "highway": data.get("highway_type", "primary")}
                elif data.get("is_tunnel"):
                    tags = {"tunnel": "yes", "layer": "-1"}
            structural_offset = compute_structural_offset(tags)

            # Effective elevation
            effective_elev = terrain_elev + structural_offset

            # Vs30 from terrain class
            vs30_terrain = _vs30_from_terrain(terrain_class, effective_elev)

            # Accessibility score
            is_bridge = bool(data.get("is_bridge", False))
            is_coastal = bool(data.get("is_coastal", False))
            node_type = data.get("node_type", "ROAD")
            accessibility = _compute_accessibility(
                effective_elev, slope_deg, twi, is_bridge, is_coastal, node_type
            )

            # Bridge amplification factor (earthquake)
            bridge_amp = compute_bridge_amplification_factor(tags, structural_offset)

            # --- Attach to graph node ---
            graph.nodes[n_id]["terrain_elevation"] = terrain_elev
            graph.nodes[n_id]["structural_offset"] = structural_offset
            graph.nodes[n_id]["effective_elevation"] = effective_elev
            graph.nodes[n_id]["elevation"] = effective_elev        # backward compat
            graph.nodes[n_id]["slope"] = slope_deg
            graph.nodes[n_id]["aspect"] = aspect_deg
            graph.nodes[n_id]["twi"] = twi
            graph.nodes[n_id]["terrain_class"] = terrain_class
            graph.nodes[n_id]["vs30_terrain"] = vs30_terrain
            graph.nodes[n_id]["accessibility_score"] = accessibility
            graph.nodes[n_id]["bridge_amplification"] = bridge_amp
            graph.nodes[n_id]["drainage_accumulation_rate"] = twi_to_accumulation_rate(twi)

        # --- 5. Persist new records to cache ---
        if to_persist:
            terrain_cache.store(to_persist)
            print(f"[TerrainProcessor] Persisted {len(to_persist)} terrain records to DB.")

        # --- 6. Enrich edges ---
        self._enrich_edges(graph, osm_tags_map)
        print(f"[TerrainProcessor] Terrain enrichment complete for {len(node_ids)} nodes.")

    def _enrich_edges(
        self, graph: nx.Graph, osm_tags_map: Dict[str, Dict[str, Any]]
    ) -> None:
        """Attach structural offset and tunnel flag to each edge."""
        for u, v, data in graph.edges(data=True):
            node_u = graph.nodes.get(u, {})
            node_v = graph.nodes.get(v, {})

            # Edge structural offset = max of both endpoints (conservative)
            off_u = node_u.get("structural_offset", 0.0)
            off_v = node_v.get("structural_offset", 0.0)
            edge_offset = max(off_u, off_v)

            # Edge effective elevation
            elev_u = node_u.get("effective_elevation", 0.0)
            elev_v = node_v.get("effective_elevation", 0.0)
            edge_elev = (elev_u + elev_v) / 2.0

            # Tunnel detection
            is_tunnel = edge_offset < 0.0 or data.get("tunnel") == "yes"

            data["elevation_offset"] = edge_offset
            data["effective_elevation"] = edge_elev
            data["is_tunnel"] = is_tunnel
