from typing import TypedDict, Dict

class FleetSpec(TypedDict, total=False):
    speed_multiplier: float
    capacity: int
    max_water_depth: float
    ignores_blockage: bool
    blockage_penalty: float
    water_traversal_factor: float
    min_water_depth: float
    land_speed_penalty: float
    label: str

FLEET_SPECIFICATIONS: Dict[str, FleetSpec] = {
    "STANDARD_CAR": {
        "speed_multiplier": 1.0,
        "capacity": 50,
        "max_water_depth": 1.5,
        "ignores_blockage": False,
        "blockage_penalty": 1.0,  # 1.0 means standard blockage rules apply
        "water_traversal_factor": 0.05,
        "label": "Standard Rescue Car"
    },
    "ZODIAC_BOAT": {
        "speed_multiplier": 1.2,
        "capacity": 25,
        "max_water_depth": 99.0,
        "ignores_blockage": False,
        "blockage_penalty": 1.0,
        "min_water_depth": 2.0,  # Needs water to traverse effectively
        "land_speed_penalty": 0.1,  # Moves at 10% speed on dry roads
        "label": "Zodiac Evac Boat"
    },
    "HIGH_WATER_TRUCK": {
        "speed_multiplier": 0.8,
        "capacity": 40,
        "max_water_depth": 8.0,
        "ignores_blockage": False,
        "blockage_penalty": 0.5,  # Can cross structural damage with 50% speed penalty
        "label": "High-Water Rescue Truck"
    },
    "HELICOPTER": {
        "speed_multiplier": 2.5,
        "capacity": 15,
        "max_water_depth": 99.0,
        "ignores_blockage": True,
        "blockage_penalty": 0.0,
        "label": "Air Rescue Helicopter"
    }
}

def get_effective_speed(vehicle_type: str, base_speed: float, water_level: float, is_blocked: bool, disaster_type: str = "FLOOD", p_danger: float = 0.0) -> float:
    """Calculates traversability speed multiplier for a vehicle based on edge conditions, disaster type, and risk levels."""
    spec = FLEET_SPECIFICATIONS.get(vehicle_type, FLEET_SPECIFICATIONS["STANDARD_CAR"])
    disaster_upper = disaster_type.upper()
    
    # 1. Cyclone wind constraints on Helicopters
    if disaster_upper == "CYCLONE" and vehicle_type == "HELICOPTER":
        if p_danger > 0.8:
            return 0.0  # Grounded due to high wind storm bands
            
    # 2. Helicopter flight ignores physical blockages (floods/rubble/debris)
    if spec.get("ignores_blockage", False) and vehicle_type == "HELICOPTER":
        return base_speed * spec["speed_multiplier"]
        
    # 3. Check blockages based on disaster scenario
    if is_blocked:
        from backend.simulation.engine import simulation_engine
        scout_clear_active = getattr(simulation_engine, 'scout_clear_mode', False)
        
        if disaster_upper == "EARTHQUAKE":
            # Only High-Water Trucks (acting as rubble clearers) can traverse rubble with high penalty
            if vehicle_type == "HIGH_WATER_TRUCK":
                mult = 0.6 if scout_clear_active else 0.3  # Rubble clearing speed boosted
                return base_speed * spec["speed_multiplier"] * mult
            else:
                if scout_clear_active:
                    return base_speed * spec["speed_multiplier"] * 0.2  # Standard cars can clear rubble slowly
                return 0.0  # Impassable rubble for all other ground vehicles
        elif disaster_upper == "CYCLONE":
            # High-water trucks can push/traverse debris with minor penalty
            if vehicle_type == "HIGH_WATER_TRUCK":
                mult = 0.8 if scout_clear_active else 0.5
                return base_speed * spec["speed_multiplier"] * mult
            else:
                if scout_clear_active:
                    return base_speed * spec["speed_multiplier"] * 0.25  # Standard cars can clear trees slowly
                return 0.0  # Blocked by fallen trees/power lines for standard cars/boats
        else:  # FLOOD or default
            if spec["blockage_penalty"] >= 1.0:
                if scout_clear_active:
                    return base_speed * spec["speed_multiplier"] * 0.25
                return 0.0
            else:
                mult = min(0.9, spec["blockage_penalty"] * 1.5) if scout_clear_active else spec["blockage_penalty"]
                return base_speed * spec["speed_multiplier"] * mult
                
    # 4. Check water depth (relevant for Floods and Cyclone storm surge)
    if disaster_upper in ("FLOOD", "CYCLONE"):
        if water_level > spec.get("max_water_depth", 99.0):
            return 0.0  # Flooded beyond capacity
            
        # Zodiac boat specific land/water speed transitions
        if vehicle_type == "ZODIAC_BOAT":
            min_w = spec.get("min_water_depth", 2.0)
            if water_level < min_w:
                return base_speed * spec["speed_multiplier"] * spec.get("land_speed_penalty", 0.1)
            else:
                return base_speed * spec["speed_multiplier"]
                
        # Standard car flood speed degradation
        from backend.config_params.parameters import params
        if vehicle_type == "STANDARD_CAR" and water_level > getattr(params, 'flood_car_caution_m', 0.15):
            max_depth = getattr(params, 'flood_car_blocked_m', 0.30)
            factor = max(0.1, 1.0 - (water_level / max(1e-5, max_depth)))
            return base_speed * spec["speed_multiplier"] * factor

    return base_speed * spec["speed_multiplier"]
