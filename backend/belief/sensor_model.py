import json
import os
import math
from typing import Literal, List, Dict, Any, Optional
from dataclasses import dataclass

SensorType = Literal["DRONE_CAMERA", "HUMAN_VISUAL", "SATELLITE_OPTICAL",
                      "CITIZEN_REPORT", "ACOUSTIC", "THERMAL"]

# Load configuration parameters
CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config_params", "sensor_config.json")
try:
    with open(CONFIG_PATH, "r") as f:
        _cfg = json.load(f)
except Exception:
    _cfg = {}

SENSOR_BASE_ACCURACY: Dict[SensorType, float] = _cfg.get("sensor_base_accuracy", {
    "DRONE_CAMERA":       0.96,
    "HUMAN_VISUAL":       0.92,
    "SATELLITE_OPTICAL":  0.81,
    "CITIZEN_REPORT":     0.55,
    "ACOUSTIC":           0.78,
    "THERMAL":            0.88
})

SENSOR_MAX_RANGE_M: Dict[SensorType, float] = _cfg.get("sensor_max_range_m", {
    "DRONE_CAMERA":       300.0,
    "HUMAN_VISUAL":        80.0,
    "SATELLITE_OPTICAL":  600.0,
    "CITIZEN_REPORT":      30.0,
    "ACOUSTIC":           120.0,
    "THERMAL":            250.0
})

_bounds = _cfg.get("confidence_bounds", {})
MIN_ETA: float = _bounds.get("min_eta", 0.51)
MAX_ETA: float = _bounds.get("max_eta", 0.99)
MIN_SENSOR_CONFIDENCE_CEILING: float = _bounds.get("min_sensor_confidence_ceiling", 0.50)

_decay = _cfg.get("age_decay_rates_per_min", {})
AGE_DECAY_RATES: Dict[str, float] = {
    "FLOOD":      _decay.get("FLOOD", 0.015),
    "EARTHQUAKE": _decay.get("EARTHQUAKE", 0.060),
    "CYCLONE":    _decay.get("CYCLONE", 0.030),
    "WILDFIRE":   _decay.get("WILDFIRE", 0.045),
    "DEFAULT":    _decay.get("DEFAULT", 0.020)
}

_vis = _cfg.get("visibility_degradation", {})
OPTICAL_SENSORS: List[str] = _vis.get("optical_sensor_types", ["DRONE_CAMERA", "HUMAN_VISUAL", "SATELLITE_OPTICAL"])
SMOKE_VISIBILITY_FACTOR: float = _vis.get("smoke_visibility_factor", 0.40)
BASE_VISIBILITY_REF_KM: float = _vis.get("base_visibility_reference_km", 5.0)
MIN_VISIBILITY_FACTOR: float = _vis.get("min_visibility_factor", 0.30)

_wind = _cfg.get("wind_degradation", {})
DRONE_WIND_THRESHOLD: float = _wind.get("drone_wind_threshold_kmh", 30.0)
DRONE_WIND_DECAY: float = _wind.get("drone_wind_decay_per_kmh", 0.01)


@dataclass
class SensorObservationQuality:
    """Rich metadata about an observation to feed XAI and dashboard panels."""
    sensor_type: SensorType
    eta: float
    variance: float
    reason_codes: List[str]
    metadata: Dict[str, Any]


@dataclass
class ObservationContext:
    sensor_type: SensorType
    age_minutes: float = 0.0
    visibility_km: float = 10.0
    distance_m: float = 0.0
    disaster_type: str = "FLOOD"
    wind_speed_kmh: float = 0.0
    smoke_present: bool = False


def evaluate_observation_quality(context: ObservationContext) -> SensorObservationQuality:
    """Calculates observation reliability eta, variance and logs diagnostic reason codes.
    All multiplicative degradation calculations represent structural modeling ASSUMPTIONS.
    """
    base_acc = SENSOR_BASE_ACCURACY.get(context.sensor_type, 0.75)
    eta = base_acc
    reasons = []

    # 1. Age decay
    decay_rate = AGE_DECAY_RATES.get(context.disaster_type.upper(), AGE_DECAY_RATES["DEFAULT"])
    if context.age_minutes > 0:
        age_factor = math.exp(-decay_rate * context.age_minutes)
        eta *= age_factor
        if age_factor < 0.90:
            reasons.append(f"Observation aged by {context.age_minutes:.1f} min")

    # 2. Visibility penalty (degradation multiplication model assumption)
    if context.sensor_type in OPTICAL_SENSORS:
        vis_ratio = max(0.0, min(1.0, context.visibility_km / max(1e-5, BASE_VISIBILITY_REF_KM)))
        if context.smoke_present:
            vis_ratio *= SMOKE_VISIBILITY_FACTOR
            reasons.append("Visibility obscured by smoke")
        
        vis_mult = MIN_VISIBILITY_FACTOR + (1.0 - MIN_VISIBILITY_FACTOR) * vis_ratio
        eta *= vis_mult
        if vis_mult < 0.85:
            reasons.append(f"Low visibility factor: {vis_mult:.2f}")

    # 3. Distance decay
    max_range = SENSOR_MAX_RANGE_M.get(context.sensor_type, 100.0)
    if context.distance_m > 0:
        dist_ratio = max(0.0, min(1.0, 1.0 - (max(0.0, context.distance_m) / max(1e-5, max_range))))
        dist_mult = 0.7 + 0.3 * dist_ratio
        eta *= dist_mult
        if dist_mult < 0.90:
            reasons.append(f"Distance to target {context.distance_m:.1f}m degrades sensor range")

    # 4. Wind penalty
    if context.sensor_type == "DRONE_CAMERA" and context.wind_speed_kmh > DRONE_WIND_THRESHOLD:
        wind_excess = context.wind_speed_kmh - DRONE_WIND_THRESHOLD
        wind_mult = max(0.5, 1.0 - wind_excess * DRONE_WIND_DECAY)
        eta *= wind_mult
        reasons.append(f"High wind gust instability ({context.wind_speed_kmh:.1f} km/h)")

    final_eta = max(MIN_ETA, min(MAX_ETA, eta))
    
    # Calculate simple binomial variance of the sensor reliability
    variance = final_eta * (1.0 - final_eta)

    meta = {
        "base_accuracy": base_acc,
        "age_minutes": context.age_minutes,
        "wind_speed_kmh": context.wind_speed_kmh,
        "distance_m": context.distance_m
    }

    return SensorObservationQuality(
        sensor_type=context.sensor_type,
        eta=final_eta,
        variance=variance,
        reason_codes=reasons,
        metadata=meta
    )
