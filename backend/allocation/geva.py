import math
from typing import Dict, Any
from backend.config import settings

# Vulnerability class multipliers — determines how much rescue urgency increases based on
# population demographics at the node. Elderly, trapped, and injured populations decay
# faster and must be reached sooner.
VULNERABILITY_MULTIPLIERS: Dict[str, float] = {
    "CRITICAL":  3.0,   # Hospitals: trapped patients, ICU, non-ambulatory
    "HIGH":      2.0,   # Residential dense areas: elderly, families with children
    "MEDIUM":    1.2,   # General residential: mixed ambulatory population
    "LOW":       0.6,   # Bridge/junction: mostly mobile adults who can self-evacuate
    "STANDARD":  1.0,   # Default
}

def get_vulnerability_multiplier(node_data: Dict[str, Any]) -> float:
    """Returns a vulnerability multiplier based on node type and demographic indicators."""
    t_imm = node_data.get('triage_immediate') or 0
    t_del = node_data.get('triage_delayed') or 0
    t_min = node_data.get('triage_minor') or 0
    total_triage = t_imm + t_del + t_min
    
    if total_triage > 0:
        # Triage weighting: Immediate=3.0, Delayed=2.0, Minor=1.2
        return (t_imm * 3.0 + t_del * 2.0 + t_min * 1.2) / total_triage

    node_type = node_data.get('node_type', 'ROAD')
    if node_type == 'HOSPITAL':
        return VULNERABILITY_MULTIPLIERS['CRITICAL']
    elif node_type == 'POPULATION_ZONE':
        pop_density = node_data.get('population', 0)
        if pop_density > 400:
            return VULNERABILITY_MULTIPLIERS['HIGH']    # Dense residential, likely elderly
        else:
            return VULNERABILITY_MULTIPLIERS['MEDIUM']
    elif node_type in ('BRIDGE', 'JUNCTION'):
        return VULNERABILITY_MULTIPLIERS['LOW']         # People on bridges can move
    return VULNERABILITY_MULTIPLIERS['STANDARD']

def calculate_ev(p_danger: float, population: int, reachability: float, t_arrival_minutes: float, vulnerability_multiplier: float = 1.0) -> float:
    """Computes Greedy Expected Value Assignment with triage vulnerability weighting.
    Formula:
      S_expected = Population * exp(-gamma * p_danger * t_arrival)
      EV = p_danger * S_expected * Reachability * VulnerabilityMultiplier
    """
    gamma = settings.SURVIVAL_DECAY_RATE
    # Survival decay: expected survivors remaining at time of arrival
    s_expected = population * math.exp(-gamma * p_danger * t_arrival_minutes)
    
    # Expected value of rescue, scaled by population vulnerability class
    ev = p_danger * s_expected * reachability * vulnerability_multiplier
    return ev
