"""
Structural Elevation Offsets
==============================
Computes how much a road segment is ABOVE (or below) ground terrain.
Keeps terrain_elevation and structural_offset strictly separate so that:

  effective_elevation = terrain_elevation + structural_offset

This distinction matters for:
  - Flood: water must rise above effective_elevation to block a road
  - Earthquake: bridges at height resonate differently (amplification factor)
  - Routing: accessible height affects rescue vehicle traversal

Hierarchy for structural offset resolution (highest priority first):
  1. OSM `height=` tag (actual recorded clearance in metres)
  2. OSM `bridge:structure=` or `bridge:movable=` → clearance type estimate
  3. OSM `layer=` integer multiplier
  4. Road class heuristic (motorway bridge, footbridge, etc.)
  5. Default 0.0 (ground level)

For tunnels (layer < 0), a negative offset is applied.
"""
from __future__ import annotations

from typing import Dict, Any, Optional

# ---------------------------------------------------------------------------
# Lookup tables
# ---------------------------------------------------------------------------

# Road class → structural offset when bridge=yes but no height tag
_HIGHWAY_BRIDGE_OFFSET_M: Dict[str, float] = {
    "motorway":    10.0,   # major viaduct / flyover
    "trunk":        9.0,
    "primary":      7.0,
    "secondary":    5.0,
    "tertiary":     4.0,
    "residential":  3.5,
    "living_street": 3.0,
    "unclassified": 4.0,
    "track":        2.5,
    "footway":      2.5,
    "path":         2.0,
}
_DEFAULT_BRIDGE_OFFSET_M = 5.0   # fallback if highway type unknown

# OSM layer integer → metres per layer (approximate)
_LAYER_OFFSET_M_PER_LAYER = 4.0   # each layer tag unit ≈ 4 m rise

# Tunnel depth per layer (negative)
_TUNNEL_DEPTH_M_PER_LAYER = 4.0  # each underground layer ≈ 4 m below surface

# Bridge structure type overrides (more precise clearance)
_BRIDGE_STRUCTURE_OFFSETS: Dict[str, float] = {
    "suspension":    18.0,
    "cable-stayed":  20.0,
    "arch":          12.0,
    "beam":           6.0,
    "cantilever":    14.0,
    "movable":        5.0,
    "viaduct":       12.0,
    "truss":          8.0,
}


def compute_structural_offset(tags: Dict[str, Any]) -> float:
    """Compute the structural elevation offset in metres above terrain.

    Parameters
    ----------
    tags : dict
        OSM tag dictionary for the way/node.

    Returns
    -------
    float
        Structural offset in metres. Positive = above ground, negative = below.
    """
    # --- Priority 1: Explicit height tag ---
    raw_height = tags.get("height") or tags.get("maxheight")
    if raw_height is not None:
        try:
            # OSM height values: "10", "10 m", "10.5"
            h = float(str(raw_height).replace("m", "").replace(" ", ""))
            if h > 0:
                return h
        except (ValueError, TypeError):
            pass

    # --- Priority 2: Tunnel (negative offset) ---
    is_tunnel = (
        tags.get("tunnel") == "yes" or
        tags.get("tunnel") == "culvert" or
        tags.get("layer", "0") not in ("0", "", None) and int(tags.get("layer", "0")) < 0
    )
    if is_tunnel:
        try:
            layer = int(tags.get("layer", -1))
        except (ValueError, TypeError):
            layer = -1
        layer = min(-1, layer)  # ensure at least -1
        return layer * _TUNNEL_DEPTH_M_PER_LAYER

    # --- Priority 3: Bridge ---
    is_bridge = (
        tags.get("bridge") == "yes" or
        tags.get("bridge") == "viaduct" or
        tags.get("man_made") == "bridge"
    )
    if is_bridge:
        # 3a. Bridge structure type
        structure = tags.get("bridge:structure") or tags.get("bridge:type", "")
        if structure in _BRIDGE_STRUCTURE_OFFSETS:
            return _BRIDGE_STRUCTURE_OFFSETS[structure]

        # 3b. Layer number (e.g. layer=2 on a double-deck bridge)
        try:
            layer = int(tags.get("layer", 1))
        except (ValueError, TypeError):
            layer = 1
        layer = max(1, layer)

        # 3c. Highway class-based offset
        highway = tags.get("highway", "")
        base_offset = _HIGHWAY_BRIDGE_OFFSET_M.get(highway, _DEFAULT_BRIDGE_OFFSET_M)
        return base_offset * layer

    # --- Priority 4: Elevated road (non-bridge) with layer tag ---
    try:
        layer = int(tags.get("layer", 0))
    except (ValueError, TypeError):
        layer = 0

    if layer > 0:
        return layer * _LAYER_OFFSET_M_PER_LAYER

    # --- Priority 5: Ground level ---
    return 0.0


def compute_bridge_amplification_factor(tags: Dict[str, Any], structural_offset: float) -> float:
    """Earthquake bridge amplification factor.
    Bridges at height can resonate with seismic lateral waves.
    Returns a multiplier applied to structural vulnerability (1.0 = no change).
    """
    is_bridge = tags.get("bridge") == "yes" or tags.get("man_made") == "bridge"
    if not is_bridge:
        return 1.0
    # Higher bridges resonate more: 1.20 at +5m, 1.45 at +15m, cap at 1.60
    return min(1.60, 1.0 + structural_offset * 0.026)
