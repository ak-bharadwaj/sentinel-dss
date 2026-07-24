# Sentinel DSS Domain-Specific Playbook

This playbook documents the domain concepts, mathematical frameworks, and database governance unique to the **Sentinel DSS (Decision Support System)** project.

---

## 1. Domain Concept Overview

Sentinel DSS is a decision support system designed for autonomous search-and-rescue resource allocation under dynamic, dynamic, and incomplete information. It integrates physical disaster simulations with Bayesian estimations and safety governance structures.

---

## 2. Mathematical Models & Physics References

When modifying or auditing algorithms, subagents (`dss_reviewer_v2`, `dss_architect_v2`) must verify that implementations adhere to these formulations:

### A. Physics Simulation Models
*   **Seismic Attenuation (BSSA14 GMPE):** Attenuation of seismic waves based on soil profile coefficients and distance metrics.
*   **Holland wind fields:** Parametric modeling of meteorological wind vectors (pressure, radius of maximum winds, coordinates).
*   **Wildfire boundaries spread (Rothermel ROS):** Rates of spread based on fuel type, wind vectors, slope, and fuel moisture.
*   **Hydrological accumulation:** Accumulation profiles based on terrain height indexes and water flow accumulation grids.

### B. Decision Support Algorithms
*   **Bayesian Observations Updates:** Confidence age decay calculations adjusting for resource position updates under dynamic info.
*   **Dijkstra Path Weights Normalization:** Route calculations adjusting node weights based on dynamic hazard zones.
*   **Bureau of Public Roads (BPR) traffic congestion:** Speed attenuation calculations based on current path congestion levels.

### C. Execution Governance Layer (EGL)
*   **Safety Overrides:** Calculates asymmetric regret and scales weights based on Mission Policy priorities.
*   **TBHO (Time-Boxed Human Override):** Enforces time-locked bounds for human overrides before autonomous fallbacks execute.

---

## 3. Database Governance

Sentinel DSS maintains two SQLite databases inside the `backend/` directory:

### A. Operational Database (`sentinel.db` / `world_state.db`)
*   Stores current world state parameters, dynamic hazard coordinate grids, resource positions, and path indexes.
*   *Write Policy:* Modified by backend simulation loops.

### B. Audit Trail Database (`egl_audit.db`)
*   An immutable log recording EGL safety parameters, regret valuations, and TBHO overrides.
*   *Write Policy:* Append-only. Updates are secured by checksum verifications.

---

## 4. Custom Verification Rules

*   **Math Attestations:** Any code changes in `backend/decision_engine/` or `backend/disaster/` must contain Pytest assertions verifying mathematical limits (e.g., wind vectors are normalized, rates of spread are non-negative).
*   **Audit Logging:** Every simulated action must log its regret valuations to `egl_audit.db` before execution.
*   **Strict Warning Scans:** You are forbidden from declaring victory or marking tasks complete if any `DeprecationWarning` (like `utcnow()`), package warning, or console error is printed during test runs. You must patch and fix these warnings first.
*   **Live UI & API Verification:** If the project includes a user interface, you MUST launch both the backend and frontend dev servers in the background, run browser screenshots, and verify visual layout alignment (preventing overlapping or invisible text) and database integration accessibility before completing verification.
