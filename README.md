# Sentinel Command: Enterprise Autonomous Disaster Response Support Engine
========================================================================================

Sentinel is a research-grade, production-calibrated Decision Support System (DSS) designed for autonomous search-and-rescue resource allocation and tactical pathfinding under corrupted, dynamic, and incomplete information baselines. 

---

## 🏗️ 1. System Components & Architecture

Sentinel utilizes a modern, decoupled architecture separating the high-performance simulation engine from the operator dashboard:

```
                  +----------------------------------------------+
                  |            Next.js Tactical UI               |
                  |     (Canvas-based Leaflet Canvas Renderer)   |
                  +-----------------------+----------------------+
                                          | JSON HTTP / Event Stream
                                          v
                  +----------------------------------------------+
                  |               FastAPI Gateway                |
                  |       (ASGI Controller / Uvicorn Server)     |
                  +-----------------------+----------------------+
                                          | SQLAlchemy Engine
                                          v
+------------------+     +----------------+---------------+     +------------------+
| belief/          |     | world_model/                   |     | disaster/        |
| - sensor_model   |<--->| - edge_state_tensor.py (DEST)  |<--->| - flood.py       |
| - bayesian_upd   |     | - world_state.py (Memory)      |     | - earthquake.py  |
+------------------+     +--------------------------------+     +------------------+
```

### Directory Structure & Module Ledger

```
├── backend/
│   ├── config_params/       # Central configuration store (Parameters class, sensor metadata)
│   ├── world_model/         # Dynamic Edge-State Tensor (DEST), SQLite models, DB sync interfaces
│   ├── belief/              # SensorObservationQuality evaluator, Bayesian update math, confidence decay
│   ├── disaster/            # Physical propagation logic (BSSA14 GMPE, Holland wind field, Rothermel ROS)
│   ├── routing/             # Multi-hazard risk projections, dynamic BPR road congestion multipliers
│   ├── allocation/          # UWEV allocation logic, greedy detours, high-value target prioritization
│   └── api/                 # REST controllers (Uvicorn HTTP request routes)
├── frontend/
│   ├── app/                 # Next.js UI React layout components
│   └── components/          # Tactical map views, XAI rationale alerts, signal broadcasters
└── datasets/                # Validated cached OpenStreetMap XML networks
```

---

## 💾 2. Database Schema & Data Models

Sentinel maintains a persistent state using SQLite. The database schema stores node properties, coordinate metrics, edge capacities, and live agent telemetry.

```
                    +------------------------+
                    |         nodes          |
                    +------------------------+
                    | id (PK, String)        |
                    | node_type (String)     |
                    | lat (Float)            |
                    | lon (Float)            |
                    | population (Int)       |
                    | triage_immediate (Int) |
                    | triage_delayed (Int)   |
                    | triage_minor (Int)     |
                    | p_danger (Float)       |
                    | p_state_correct (Float)|
                    | status (String)        |
                    | last_observed (DateTime)|
                    +------------------------+
                                | 1
                                |
                                | N
                    +------------------------+
                    |         edges          |
                    +------------------------+
                    | id (PK, String)        |
                    | source (FK, String)    |
                    | target (FK, String)    |
                    | distance (Float)       |
                    | confidence (Float)     |
                    | blocked (Boolean)      |
                    | speed_factor (Float)   |
                    | name (String)          |
                    | geometry (JSON)        |
                    +------------------------+
```

---

## ⚙️ 3. Configurable Parameter Store (`config_params/`)

All heuristic defaults have been externalized to promote research reproducibility:
*   `parameters.json`: Root override calibration parameters. Contains bounds like caution levels and simulation limits.
*   `sensor_config.json`: Standardizes baseline accuracies (`DRONE_CAMERA=0.96`, `HUMAN_VISUAL=0.92`, `SATELLITE_OPTICAL=0.81`) and wind/smoke visibility multipliers.
*   `routing_weights.json`: Configures multi-objective normalisation factors, helicopter flight boundaries, and BPR constants.
*   `vehicle_profiles.json`: Defines operational specifications (e.g. standard cars caution water depth at `0.15m`, high-water trucks caution at `0.80m`).

---

## 🧠 4. Implementation Details & Mathematical Equations

### A. Context-Aware Bayesian Telemetry
Whenever scouts dispatch reports, safety beliefs update using a context-aware Bayesian update formulation:

$$P(\text{danger} \mid \text{Obs}) = \frac{P(\text{Obs} \mid \text{danger}) \cdot P_{\text{prior}}}{P(\text{Obs} \mid \text{danger}) \cdot P_{\text{prior}} + P(\text{Obs} \mid \text{safe}) \cdot (1 - P_{\text{prior}})}$$

Observations automatically decay in value over time towards the maximum uncertainty point ($0.5$):

$$P_{\text{new}} = 0.5 + (P_{\text{prior}} - 0.5) \cdot e^{-\lambda}$$

Adjacent confidence updates scale exponentially using distance, visibility, and line-of-sight metrics:

$$\text{Confidence Gain} = e^{-\frac{\text{Distance}}{\text{Sensor\_Range}}} \times \text{Visibility\_Factor} \times \text{Line\_Of\_Sight}$$

### B. Normalized Cost Routing
Edge travel costs ($C_e$) are normalized to a dimensionless scale using a reference transit time ($360s$) to scale alongside penalty variables:

$$C_e = \frac{T_{\text{travel}}}{360} + w_{\text{risk}} \cdot P_{\text{danger\_vehicle}} \cdot \mu_{\text{safe}} + w_{\text{uncertainty}} \cdot (1 - P_{\text{state\_correct}})$$

### C. Dynamic BPR Congestion Feedback
Dijkstra routing weights dynamically scale with vehicle count on the segment using the Bureau of Public Roads (BPR) formulation:

$$T_{\text{congested}} = T_{\text{free}} \times \left(1 + \alpha \left(\frac{\text{Flow}}{\text{Capacity}}\right)^\beta\right)$$

### D. Physical Disaster Propagation
*   **BSSA14 GMPE**: Attenuates Peak Ground Acceleration (PGA) using Boore-Stewart-Seyhan-Atkinson 2014 equations, using geological Vs30 values or fallback landuse proxies.
*   **Holland B Wind Profile**: Generates gradient surface wind fields using the Holland 1980 wind speed equations combined with dynamic eyewall pressure deficits and moving eye trajectories.
*   **Rothermel Rate of Spread (ROS)**: Models vegetation fire propagation rate based on Anderson fuel loads, slope gradients, moisture content, and downwind biases.

---

## 🚀 5. Quick Start & Execution Stepper

### Step 1: Install Dependencies
```bash
pip install fastapi uvicorn sqlalchemy networkx numpy scipy pydantic
```
*(Optional)* Install `cupy` for CUDA-accelerated sparse matrix Dijkstra routing.

### Step 2: Launch ASGI API Server
```bash
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

### Step 3: Run Frontend Tactical Console
```bash
cd frontend
npm install
npm run dev
```
Open tactical dashboard at `http://localhost:3000`.

---

## 🔬 6. Validation Pipelines & Benchmark Tests

Sentinel ships with built-in scripts to verify performance metrics and routing robustness:

### Sensitivity Testing
Varies preference weights dynamically to record path selection divergence:
```bash
python -c "import sys; sys.path.append('.'); from tests.sensitivity_test import run_sensitivity_analysis; run_sensitivity_analysis()"
```

### Scalability Performance Benchmarking
Outputs simulation execution timings across core modules:
```bash
python -c "import sys; sys.path.append('.'); from tests.scalability_benchmark import run_scalability_benchmark; run_scalability_benchmark()"
```


