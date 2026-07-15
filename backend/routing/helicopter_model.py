from backend.routing.cost_config import (
    HELI_SPEED_KMH, HELI_WIND_LIMIT_KMH, HELI_SMOKE_NO_FLY, HELI_NO_PAD_COST, REFERENCE_TIME_S
)

def helicopter_edge_cost(distance_m: float, node_u_data: dict, node_v_data: dict, weather: dict | None = None) -> float:
    """Physics-informed helicopter routing cost calculations.
    All calculations are modeling assumptions.
    """
    wind_speed = 0.0
    if weather and 'current_weather' in weather:
        wind_speed = weather['current_weather'].get('windspeed', 0.0)
        
    if wind_speed > HELI_WIND_LIMIT_KMH:
        return 1e9  # Extreme winds ground helicopters
        
    smoke_u = node_u_data.get('smoke_density', 0.0)
    smoke_v = node_v_data.get('smoke_density', 0.0)
    if max(smoke_u, smoke_v) > HELI_SMOKE_NO_FLY:
        return 1e9  # Heavy smoke visibility limits
        
    fire_u = node_u_data.get('status') == 'FIRE'
    fire_v = node_v_data.get('status') == 'FIRE'
    if fire_u or fire_v:
        return 1e9  # Active fire plume thermal turbulence
        
    # Convert meters distance to km, compute transit minutes
    dist_km = distance_m / 1000.0
    transit_hours = dist_km / HELI_SPEED_KMH
    transit_seconds = transit_hours * 3600.0
    
    cost_norm = transit_seconds / max(1.0, REFERENCE_TIME_S)
    
    # Helipad availability check
    has_pad = node_v_data.get('has_helipad', False) or node_v_data.get('node_type') in ('HOSPITAL', 'SHELTER')
    if not has_pad:
        cost_norm += HELI_NO_PAD_COST
        
    return cost_norm
