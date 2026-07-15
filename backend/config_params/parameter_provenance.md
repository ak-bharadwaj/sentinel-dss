# Sentinel Parameters Provenance & Physical Units Specification
==============================================================

This document details the scientific source, physical units, and calibration status of every model parameter configured in Sentinel DSS. All inputs must adhere strictly to these defined units to avoid numeric errors.

---

## 1. Physical Units Specification

The internal physics engines and calculations enforce the following standard SI units:

| Dimension | Physical Unit | Symbol | Usage |
|---|---|---|---|
| **Distance / Length** | Meters | $m$ | Coordinates, edge lengths, water depths, ranges |
| **Time** | Seconds | $s$ | Travel time, computation metrics, steps |
| **Speed** | Meters per second | $m/s$ | Agent speeds, water flow velocities |
| **Acceleration** | g-units | $g$ | Peak Ground Acceleration (PGA) seismic force |
| **Pressure** | Hectopascals | $hPa$ | Cyclone barometric pressure (eyewall/deficit) |
| **Mass Density** | Kilograms per cubic meter | $kg/m^3$ | Surface air density ($\rho \approx 1.15$ baseline) |

---

## 2. Parameter Provenance & Validation Details

### Bayesian & Observation Models (`sensor_config.json`)

*   **`sensor_base_accuracy` (eta, $\eta$)**
    *   *Unit*: Dimensionless Probability $[0, 1]$
    *   *Source*: Sensor manufacturer baseline specifications under clear conditions (e.g. thermal resolution tolerances, optical visibility).
    *   *Status*: Engineering assumptions to be calibrated via field trials.
*   **`sensor_max_range_m`**
    *   *Unit*: Meters ($m$)
    *   *Source*: Typical operational altitude limits for drones and line-of-sight visual fields.
    *   *Status*: Engineering default.
*   **`min_eta`**
    *   *Unit*: Dimensionless Probability $[0, 1]$
    *   *Source*: Bayesian constraint threshold. Setting $\eta > 0.50$ ensures observations remain directionally positive indicators.
    *   *Status*: Bounded to $0.51$.

### Routing Weight Profiles (`routing_weights.json`)

*   **`w_time` / `w_risk` / `w_uncertainty`**
    *   *Unit*: Dimensionless weights
    *   *Source*: Multi-objective optimization preference weights. Scaled against reference travel time ($360s$).
    *   *Status*: Configurable variables. Subject to Sensitivity Analysis.
*   **`bpr_congestion` (`alpha`, `beta`)**
    *   *Unit*: Dimensionless constants
    *   *Source*: US Highway Capacity Manual, Bureau of Public Roads (BPR) standard parameters (commonly $\alpha = 0.15$, $\beta = 4.0$).
    *   *Status*: Calibrated standard.

### Disaster & Casualty Models (`hazard_models.json`, `parameters.json`)

*   **`gamma_flood` / `gamma_earthquake` / `gamma_cyclone` / `gamma_wildfire`**
    *   *Unit*: $1/\text{minute}$ (decay rate)
    *   *Source*: Regional casualty statistics (e.g., trapped-rubble statistics from Kobe 1995 earthquake showing $t_{1/2} \approx 43\text{ min}$, NIST thermal injury thresholds for active fire proximity).
    *   *Status*: Calibrated standard.
*   **`bssa14` coefficients**
    *   *Unit*: Empirical coefficients
    *   *Source*: Boore, Stewart, Seyhan & Atkinson 2014 (BSSA14) NGA-West2 GMPE publication.
    *   *Status*: Verified Standard.
*   **`holland_wind` shape factor $B$**
    *   *Unit*: Dimensionless constant $[1.0, 2.5]$
    *   *Source*: Holland (1980) parametric gradient wind model. Computed dynamically using central pressure deficits.
    *   *Status*: Verified Standard.
*   **`flood_car_blocked_m` / `flood_bridge_blocked_m`**
    *   *Unit*: Meters ($m$)
    *   *Source*: Standard vehicle chassis clearance limits (FEMA depth-damage curves: cars drift at 0.30m, high-water trucks at 0.80m).
    *   *Status*: Standard hydraulic parameters.
