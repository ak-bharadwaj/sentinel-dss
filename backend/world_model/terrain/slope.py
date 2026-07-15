"""
Slope & Aspect Computation
============================
Computes terrain slope (gradient) and aspect (direction of steepest descent)
from a set of point elevations using finite-difference approximation.

Outputs per node:
  slope       — degrees from horizontal (0° flat, 90° vertical cliff)
  aspect      — compass bearing of steepest downslope (0–360°, 0 = North)

Used by:
  - Flood drainage index (steeper slope → faster runoff)
  - Terrain accessibility score (cars struggle on steep slopes)
  - Routing terrain cost (slope penalty for land vehicles)
"""
from __future__ import annotations

import math
from typing import Dict, Tuple, Optional, List

LatLon = Tuple[float, float]


def compute_slope_degrees(
    lat: float,
    lon: float,
    elevation_map: Dict[LatLon, float],
    delta_deg: float = 0.001,   # ≈ 111 m at equator
) -> Tuple[float, float]:
    """Estimate slope and aspect at (lat, lon) using a 3x3 finite-difference kernel.
    
    Parameters
    ----------
    lat, lon : float
        Point of interest.
    elevation_map : dict
        Known elevations as (lat, lon) → metres. May be sparse.
    delta_deg : float
        Grid spacing in degrees for finite differences (default ≈ 111 m).

    Returns
    -------
    (slope_degrees, aspect_degrees)
        slope: 0° = flat, 90° = vertical.
        aspect: compass bearing of steepest descent, 0° = North.
    """
    # Lookup helpers — fall back to centre elevation if neighbour missing
    def elev(dlat: float, dlon: float) -> float:
        key = (round(lat + dlat, 4), round(lon + dlon, 4))
        if key in elevation_map:
            return elevation_map[key]
        # nearest key in map
        centre_key = (round(lat, 4), round(lon, 4))
        return elevation_map.get(centre_key, 0.0)

    # Metres per degree (approximate)
    m_per_lat = 111000.0
    m_per_lon = 111000.0 * math.cos(math.radians(lat))

    # East–West gradient (dz/dx)
    dz_dx = (elev(0, delta_deg) - elev(0, -delta_deg)) / (2.0 * delta_deg * m_per_lon)

    # North–South gradient (dz/dy)
    dz_dy = (elev(delta_deg, 0) - elev(-delta_deg, 0)) / (2.0 * delta_deg * m_per_lat)

    # Gradient magnitude → slope in degrees
    gradient_magnitude = math.sqrt(dz_dx ** 2 + dz_dy ** 2)
    slope_deg = math.degrees(math.atan(gradient_magnitude))

    # Aspect: bearing of steepest downslope
    # atan2 gives angle from East; we convert to North-based compass
    aspect_rad = math.atan2(-dz_dy, dz_dx)  # negative dz_dy because downslope
    aspect_deg = (math.degrees(aspect_rad) + 360.0) % 360.0

    return slope_deg, aspect_deg


def slope_accessibility_multiplier(slope_deg: float, vehicle_type: str = "STANDARD_CAR") -> float:
    """Convert slope in degrees to a routing cost multiplier for a given vehicle type.
    
    Returns a multiplier ≥ 1.0 (1.0 = no penalty, higher = harder to traverse).
    """
    if vehicle_type == "HELICOPTER":
        return 1.0   # helicopters ignore slope
    if vehicle_type == "ZODIAC_BOAT":
        return 1.0   # boats ignore slope (they follow water depth)
    
    # Land vehicles degrade on steep slopes
    # Car: negligible penalty <5°, severe >20°, impassable >35°
    if vehicle_type == "HIGH_WATER_TRUCK":
        # Trucks have lower centre of gravity, handle steeper slopes
        if slope_deg < 8.0:
            return 1.0
        if slope_deg < 20.0:
            return 1.0 + (slope_deg - 8.0) * 0.04
        if slope_deg < 30.0:
            return 1.5 + (slope_deg - 20.0) * 0.1
        return 2.5
    else:  # STANDARD_CAR
        if slope_deg < 5.0:
            return 1.0
        if slope_deg < 15.0:
            return 1.0 + (slope_deg - 5.0) * 0.06
        if slope_deg < 25.0:
            return 1.6 + (slope_deg - 15.0) * 0.12
        if slope_deg < 35.0:
            return 2.8 + (slope_deg - 25.0) * 0.2
        return 5.0   # near-vertical — effectively impassable
