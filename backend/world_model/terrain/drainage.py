"""
Drainage Index Computation
============================
Computes the Topographic Wetness Index (TWI) — a standard geomorphological
metric for predicting where water accumulates across a landscape.

  TWI = ln(A / tan(β))

where:
  A = upslope contributing area (approximated by inverse slope rank)
  β = local slope in radians

Interpretation:
  High TWI  (>8) → natural drainage basin / hollow → water pools here (flood risk ↑)
  Low TWI   (<4) → ridge / crest → water drains away quickly (flood risk ↓)
  Medium TWI (4–8) → hillslope → moderate drainage

Used by:
  - Flood module: water accumulation rate scales with TWI
  - Terrain accessibility score: waterlogged depressions are harder to traverse
  - TerrainTensor: stored as edge_drainage per edge
"""
from __future__ import annotations

import math
from typing import Dict, Tuple

LatLon = Tuple[float, float]


def compute_twi(slope_deg: float, area_proxy: float = 1.0) -> float:
    """Compute Topographic Wetness Index for a node.

    Parameters
    ----------
    slope_deg : float
        Local slope in degrees (from slope.py).
    area_proxy : float
        Upslope contributing area proxy. Since we don't have a full DEM
        raster, this is approximated as 1 / (normalised slope rank + 0.01),
        i.e. flatter terrain has a larger contributing area proxy.
        Default 1.0 gives a neutral baseline.

    Returns
    -------
    float
        TWI value in range [0, ~15]. Clipped at 15 to avoid log divergence
        on perfectly flat terrain.
    """
    # Convert slope to radians; floor at 0.1° to avoid tan(0) = 0 divergence
    slope_rad = math.radians(max(0.1, slope_deg))
    tan_beta = math.tan(slope_rad)
    tan_beta = max(1e-6, tan_beta)   # numerical safety

    twi = math.log(area_proxy / tan_beta)
    return max(0.0, min(15.0, twi))


def twi_to_accumulation_rate(twi: float) -> float:
    """Convert TWI to a water accumulation rate multiplier.

    Maps TWI → multiplier applied to rainfall accumulation per step.
      TWI < 4  → 0.6  (ridge — drains quickly)
      TWI 4–6  → 1.0  (hillslope — baseline)
      TWI 6–8  → 1.4  (concave slope — some pooling)
      TWI 8–10 → 1.9  (valley floor — significant pooling)
      TWI > 10 → 2.5  (drainage basin / hollow — maximum pooling)
    """
    if twi < 4.0:
        return 0.6
    elif twi < 6.0:
        return 1.0 + (twi - 4.0) * 0.2
    elif twi < 8.0:
        return 1.4 + (twi - 6.0) * 0.25
    elif twi < 10.0:
        return 1.9 + (twi - 8.0) * 0.3
    else:
        return min(2.5, 1.9 + (twi - 8.0) * 0.3)


def classify_drainage(twi: float) -> str:
    """Classify a node's drainage characteristic from its TWI."""
    if twi >= 9.0:
        return "BASIN"       # depression / natural drainage basin
    elif twi >= 7.0:
        return "VALLEY"      # valley floor
    elif twi >= 5.0:
        return "SLOPE"       # hillslope
    elif twi >= 3.0:
        return "CREST"       # ridge / crest
    else:
        return "PEAK"        # exposed peak / divide
