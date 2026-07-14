# Sentinel Command: Tactical Planning & Multi-Disaster Blueprint

This document outlines the design specification and conceptual architecture for the Sentinel Autonomous Disaster Response System, covering disaster urgency mapping, intent-driven scouting, human-readable explainability, and the self-correcting dynamic planning engine.

---

## 1. Multi-Disaster Rationality & Urgency Model

To align the AI's operations with the physical reality of different emergencies, we define distinct decay rates, threat speeds, and trafficability matrices for each scenario.

### Urgency & Health Decay Parameters
| Parameter | Flood Scenario | Earthquake Scenario | Cyclone Scenario |
| :--- | :--- | :--- | :--- |
| **Disaster Velocity** | **Slow/Creeping** | **Instantaneous/Tremor** | **Highly Dynamic** |
| **Triage Immediate Decay** | `0.4% / step` (Slow hypothermia/drowning risk) | `4.0% / step` (Trapped in collapsed rubble; high suffocation risk) | `1.5% / step` (Debris injuries, wind exposure) |
| **Triage Delayed Decay** | `0.1% / step` | `1.2% / step` | `0.5% / step` |
| **Threat Progression** | Tide shifts (water levels rise/drain) | Expanding seismic aftershock front | Dynamic wind gust storm bands |
| **Clearance Method** | Recedes naturally (low tide drainage) | Must be cleared manually | Must be cleared manually |

### Vehicle Trafficability & Clearance Matrix
* **Flood Water:** Deep water (>80cm) blocks standard cars, but is passable for High-Water Trucks and Zodiac Boats.
* **Earthquake Rubble:** Concrete structural debris is 100% impassable to all land vehicles. **High-Water Trucks (acting as Excavators)** must spend 15 steps clearing the segment. Helicopters fly over unaffected.
* **Cyclone Debris:** Fallen trees block standard cars and boats. **Rescue Teams** can clear them in 8 steps. **Helicopters** are grounded in wind storm bands (`p_danger > 0.8`).

---

## 2. Targeted Scouting & Verification Logic

Scouting is intent-driven to conserve scout battery/fuel and focus strictly on segments that impact rescue efficiency.

* **Reachability-Based Auto-Dispatch (Isolation Alarm):** If a survivor zone is completely cut off (`reachability == 0` due to surrounding blockages), the system triggers a **Critical Isolation Alarm** and automatically dispatches the nearest Scout to verify the boundary bottleneck edge and find an entry corridor.
* **Counter-Factual HVT Analysis & Priority Ranking:** 
  The AI simulates routing from survivors to havens ignoring blockages. If the unblocked route is $\ge 40\%$ faster than the detour, the blocked segment is marked as a **High-Value Target (HVT)**.
  - **HVT Priority Score:** The AI dynamically ranks HVTs using the formula:  
    `HVT Priority = (Detour Time Saved) * (Trapped Population Behind Blockage)`
  - **Visual Alert Triage:** High-priority HVTs (blocking large numbers of survivors) flash with a **pulsing orange glow** on the map, while lower-priority HVTs show a **solid orange dashed glow** (`#ea580c`) to direct operator focus.
* **Opportunistic Passive Verification:** Moving agents have a `50m–60m` sensor range. Any blocked edge within this radius is automatically updated to ground truth in the belief graph on the fly.

---

## 3. Human-Readable Explanations & Node Naming

Raw node IDs (e.g., `24958102`) are meaningless to human dispatchers. The system translates graph data into plain English:

* **Street Names on Edges:** Extracts the OpenStreetMap `name` tag from XML (e.g., `"JVLR"`, `"LBS Marg"`) and attaches it to edges.
* **Segment-Between-Intersections Naming:** Road segments are dynamically named using their start and end intersections:  
  `"JVLR (between LBS Marg Junction and IIT Gate)"`
* **Landmark Offsets:** Measures distance to the closest haven:  
  `"JVLR (350m west of Hiranandani Hospital, Powai)"`
* **Neighborhood Geofencing:** Bounding boxes map coordinate ranges to neighborhoods (e.g. *Powai*, *Juhu*, *Vikhroli East*) to append location context to events.

---

## 4. Rolling Horizon Objective Planning (The Judge's Defense)

### The Critique
*"In a disaster, a predefined static plan is useless because environments are unpredictable and chaotic."*

### Our Defense & Solution
We do not create a static plan. We implement a **Rolling Horizon Objective Tree**. The system plans initial baseline objectives, but actively **mutates and adapts** them in real-time as reality changes.

* **Pre-Mission Planning Phase ("Plan Objectives" Button):**
  Before starting the simulation, the operator clicks a button. The AI clusters the map into **3 to 4 colored Tactical Objectives** (e.g. Blue, Purple, Teal) and outlines the baseline strategy.
* **Interactive Objective Toggle:**
  The operator can toggle the map view between:
  - **Blockages View:** Standard red/green lines.
  - **Tactical Objectives View:** Overlays roads in their Objective color (e.g., Cyan for Sector 1), showing sector progress.
* **Plan Deviation Index (PDI):**
  A dashboard metric measuring how much the active plan has mutated from the initial baseline (e.g. `"Plan Deviation: 25% (3 routes replanned, 1 sector re-prioritized)"`). This proves the system is dynamically adapting to chaos rather than following a rigid plan.
* **Explainable AI (XAI) Mutation Logs:**
  Whenever an objective changes, it logs the logical rationale:  
  `"🔄 [Objective Mutation] Evacuate Juhu Hub priority increased. Reason: Cyclone wind speeds increased, accelerating survivor health decay. Diverting Rescue_3 from Objective 1."`

---

## 5. Advanced EOC Command Features & Self-Correction

To resolve critiques regarding realistic simulation variables, we map out three advanced systems addressing Civilian Behavior, Decentralized Comms, and Operator Overload.

### A. Civilian Self-Evacuation & Traffic Congestion (Human Element)
* **Autonomous Crowds:** A portion of survivors in low-threat areas will autonomously walk or drive towards the nearest visible Safe Haven.
* **The Offline Broadcast Model ("Where is My Train" Logic):**
  To route civilians safely without internet/cellular data, we utilize a **Pre-cached Map + Low-bandwidth Delta Signaling** architecture:
  - **Pre-Cached Map Cache:** Civilians have the city's road network pre-downloaded and stored in local phone memory before the disaster.
  - **Low-Bandwidth Deltas:** Instead of transmitting heavy graphical maps, the EOC broadcasts tiny text-based index deltas (e.g. `B:452,18 | H:12`, which is under 50 bytes) representing blocked edges and active havens.
  - **No-Internet Transmission Mediums:** These deltas are transmitted offline via **Cell Broadcast (CB)** signaling channels (which bypass data networks) or **FM Radio RDS (Radio Data System)**.
  - **Offline GPS Overlay:** The civilian's phone receives this tiny packet, overlays the blockages onto the cached offline map, and uses the phone's offline GPS sensor to route them to safety.
* **Crowdsourced Civilian Pings (Passive Reverse Telemetry):**
  - Even with cell networks down, mobile phones can broadcast short, low-frequency automated SMS pings back to the EOC E911 signaling towers.
  - As civilians attempt to self-evacuate, if a device detects that it has been stopped for >3 minutes on a road segment (via phone accelerometer + GPS), it automatically sends a background SMS packet: `"STUCK: Edge_452"`.
  - The EOC AI aggregates these incoming pings. If multiple separate devices report a `"STUCK"` status on the same edge, the AI instantly marks it as **Blocked** in the belief graph—**turning the civilian population into a massive, crowdsourced sensor network.**
* **EOC Strategic Broadcast:** The commander can toggle between:
  - **Shelter-in-Place:** Halts civilian traffic (keeping rescue routes fast) but leaves them exposed.
  - **Directed Evacuation:** Broadcasts the offline delta package, allowing safe self-evacuation (saving some autonomously) but congests the local road network.

### B. Blackout P2P Sync & Edge Routing (Fog of War)
* **Decentralized Mobile Ad-Hoc Sync (MANET):** If Scout A and Rescue Team B cross paths inside a comms blackout zone, they perform a local **Peer-to-Peer data exchange**, syncing their maps. Once either agent exits the blackout zone, the entire shared memory is flushed back to the EOC database.
* **Onboard Local Edge Routing:** If a Rescue Team encounters a blockage inside a blackout, they do not stall; they calculate a local detour on the fly using their onboard memory cache.

### C. Cognitive Overload: Triage Alert Feed (Command Triage)
* **Split Logs Panel:** 
  1. **Telemetry Stream (Collapsible):** Low-level telemetry logs (scout moves, agent steps) are grouped and hidden by default.
  2. **EOC Triage Feed:** Displays **only** high-priority alerts that require immediate operator action:
     - `🚨 Critical Isolation Alert` (Sector cut off)
     - `⚡ HVT Blockage Alert` (Arterial detour detected)
     - `⚠️ Unexpected Obstacle` (Rescue vehicle blocked)
     - `🌊 Major Environmental Shift` (Tide cycle shifts)

---

## 6. Disaster Hyperparameter Tuning & Feature Mapping

To ensure absolute rationality in simulation updates, we define specific, tunable mathematical hyperparameters for each disaster type and map them directly to system features.

### A. Flood Hyperparameters
These values dictate the speed of water accumulation, natural drainage, and vehicle trafficability boundaries.

* **`ACCUMULATION_RATE` (Default: `0.55m / step` at Low Tide, `1.20m / step` at High Tide):**
  - **Function:** Controls water level increment on nodes during rain.
  - **Formula:** `water_level = water_level + (rain_intensity * ACCUMULATION_RATE)`
* **`RAIN_ACCUMULATION_MULTIPLIER` (Default: `1.8`):**
  - **Function:** Scales how fast rainfall accumulates on land. Increasing this simulates torrential cloudburst storms.
* **`DRAINAGE_COEFFICIENT` (Default: `3.2m / step` at Low Tide):**
  - **Function:** Controls the speed of natural floodwater drainage during low tide.
  - **Formula:** `water_level = max(0.0, water_level - DRAINAGE_COEFFICIENT)`
* **`FLUID_FLOW_RATE` (Default: `0.12` / `12%`):**
  - **Function:** The rate at which floodwater propagates downhill to adjacent nodes during gravity spreads.
  - **Formula:** `flow = (water_level_u - water_level_v) * FLUID_FLOW_RATE`
* **`FLOOD_THRESH_NODE` (Default: `15.0`):**
  - **Function:** The water level depth units above which a standard intersection or residential zone is marked as submerged (`FLOODED`) and all connecting roads are blocked.
* **`STRUCTURAL_BRIDGE_FLOOD_LIMIT` (Default: `20.0`):**
  - **Function:** The water level threshold above which a bridge is officially closed due to structural safety limits.
* **`CRITICAL_DEPTH_STANDARD_CAR` (Default: `150mm` / `0.15m`):**
  - **Function:** Depth above which standard rescue vehicles slow down; at `1.5m` they are completely blocked.
* **`CRITICAL_DEPTH_TRUCK` (Default: `800mm` / `8.0m` in-engine spec):**
  - **Function:** Depth limit for High-Water Trucks.
* **`ZODIAC_MIN_DEPTH` (Default: `200mm` / `2.0` in-engine spec):**
  - **Function:** Minimum water level needed for boats to avoid a `90%` dry-land speed penalty.

### B. Earthquake Hyperparameters
These define the propagation speed of the tremor waves and the structural destruction of municipal links.

* **`SHOCKWAVE_START_RADIUS` (Default: `0.003 degrees` / `~300 meters`):**
  - **Function:** The initial epicenter tremor radius.
* **`SHOCKWAVE_VELOCITY` (Default: `0.004 degrees / step` or `~400 meters / minute`):**
  - **Function:** Determines the expansion speed of the seismic damage radius from the epicenter.
  - **Formula:** `shockwave_radius = SHOCKWAVE_START_RADIUS + (step * SHOCKWAVE_VELOCITY)`
* **`ATTENUATION_COEFFICIENT` (Default: `Decay factor over distance`):**
  - **Function:** Calculates how shockwave intensity decays over distance to scale structural damage.
  - **Formula:** `intensity = max(0.1, 1.0 - (dist_to_epicenter / shockwave_radius))`
* **`SOIL_AMPLIFICATION_FACTOR` (Default: Range `[0.2, 1.0]` per node):**
  - **Function:** Simulates local geological amplification using Perlin noise values mapping soil density.
* **`STRUCTURAL_VULNERABILITY` (Hospitals: `0.1`, Shelters: `0.1`, Populations: `0.6`, Bridges: `0.8`):**
  - **Function:** Sets base damage probability for different infrastructure types during shakes.
* **`RUBBLE_COLLAPSE_THRESHOLD` (Default: `p_danger > 0.88`):**
  - **Function:** The hazard threat level above which a road collapses and spawns solid concrete rubble.
* **`RUBBLE_CLEARANCE_WORK` (Default: `15 steps` of High-Water Truck labor):**
  - **Function:** Work units required to clear a blocked rubble segment.

### C. Cyclone Hyperparameters
These govern wind forces, flight boundaries, and the Eye of the Storm mechanics.

* **`MAX_WIND_SPEED` (Default: `120 km/h` base, peaking at `200 km/h` near eyewall):**
  - **Function:** Controls wind force mapping.
* **`EYE_RADIUS` (Default: `0.015 degrees` or `~1.5 km`):**
  - **Function:** Radial calm zone. Inside `EYE_RADIUS`, wind speed drop to `15 km/h`, but eyewall boundary has maximum intensity.
* **`BASE_WIND_GUST_PROBABILITY_COEFF` (Default: `1000.0`):**
  - **Function:** Winds gusts are modeled as `wind_speed / BASE_WIND_GUST_PROBABILITY_COEFF`. Tuning this coefficient controls how frequently random wind gusts rip off roofs or collapse power grids.
  - **Formula:** `gust_probability = wind_speed / BASE_WIND_GUST_PROBABILITY_COEFF`
* **`CYCLONE_DANGER_THRESHOLD` (Default: `0.90`):**
  - **Function:** The threat level at which wind/surge damage officially collapses trees and blocks roads.
* **`HELICOPTER_FLIGHT_LIMIT` (Default: `80 km/h` / `p_danger > 0.8`):**
  - **Function:** Safety wind limit above which helicopters are grounded.
* **`TREE_CLEARANCE_WORK` (Default: `8 steps` of Rescue Team labor):**
  - **Function:** Work units required to cut and clear fallen trees.

---

## 7. Complete Feature-Scenario Mapping Matrix

| Feature Name | Flood Scenario | Earthquake Scenario | Cyclone Scenario | Primary Hyperparameter |
| :--- | :--- | :--- | :--- | :--- |
| **Prior Hazard Generator** | Elevation & water proximity | Fault proximity & soil class | Coastal proximity & storm Eye | `dist_to_water`, `soil_amp`, `wind_speed` |
| **Dynamic Blockages** | Rising water submergence | Seismic structural collapse | Gust wind-gust tree/power falls | `ACCUMULATION_RATE`, `RUBBLE_COLLAPSE_THRESHOLD`, `WIND_GUST_PROBABILITY` |
| **Pathfinding Weights** | Water depth penalties | Rubble blocking & bypass limits | Debris blocking & flight grounding | `CRITICAL_DEPTH`, `RUBBLE_CLEARANCE_WORK`, `HELICOPTER_FLIGHT_LIMIT` |
| **HVT Highlights** | Detours due to flood water | Detours due to collapsed bridges | Detours due to fallen trees | `Detour Time Saved Delta` |
| **Reachability Alarm** | Isolated sectors by water | Isolated sectors by structural rubble | Isolated sectors by fallen trees | `Isolated Components Count` |
| **Scouting Auto-Dispatch**| Verify dynamic water depth | Verify structural bridge collapses | Verify tree blockage severity | `Reachability == 0` |
| **EOC Alert Triage** | Water depth alerts | Rubble & bridge collapses | Wind warnings & grounded flight alerts| `p_danger` threshold |
| **Human-Readable Naming**| Segment-between-water bodies | Segment-between-collapsed bridges | Segment-between-debris blocks | OSM Way `name` tag |
| **Civilian Self-Evacuation**| Drowns in >15cm water | Trapped by collapsed rubble | Struck by flying debris / winds | `CRITICAL_DEPTH_STANDARD_CAR`, `p_danger` |
| **Clearance Mechanics** | Natural drainage | High-Water Trucks (Excavators) | Rescue Teams (Chainsaws) | `DRAINAGE_COEFFICIENT`, `RUBBLE_CLEARANCE_WORK`, `TREE_CLEARANCE_WORK` |

---

## 8. Compound Disaster Cascades (Multi-Hazard Interactions)

Sentinel models how disasters trigger or amplify secondary hazards, ensuring realistic cascading simulation behaviors.

### A. Cyclone-Induced Flood Cascade (Storm Surge & Driving Rain)
* **Operational Coupling:** High winds near the storm eye push coastal waters inland and increase rainfall density, triggering secondary flooding.
* **Equation:**  
  `Effective Rainfall = Base Rainfall * (1.0 + (wind_speed / 100.0))`
* **Impact:** In a Cyclone, coastal areas will flood dynamically. The AI must route rescue vehicles away from these shores due to both storm surge flooding and wind hazards.

### B. Earthquake-Induced Landslides (Elevation Slope Shaking)
* **Operational Coupling:** Seismic shaking on steep hills causes landslides, blocking mountain roads much faster than flat highways.
* **Equation:**  
  `Vulnerability = Base Vulnerability * (1.0 + elevation_slope)`
* **Impact:** Roads in high-elevation slope junctions (e.g. Powai or Juhu hills) collapse into rubble faster during earthquakes, forcing the AI to route rescue trucks along valley bypasses.

---

## 9. Implementation Architecture (Phase 1 & 2 Status)

We have successfully integrated the mathematical and logical structures from this blueprint into the live engine:
*   **HVT Prioritization**: Computes priority as:
    $$\text{HVT Priority} = \text{Detour Time Saved} \times \text{Trapped Population}$$
    This priority score is synced to both the belief and ground truth graphs and exposed in the API.
*   **Dynamic Intersection Naming**: Node numbers are dynamically mapped to readable street intersections (e.g., `Avenue 1 & Street A Junction`) using adjacent OSM edge tags, completely eliminating raw IDs in EOC alerts.
*   **Strategic Command Decisions**: Triggers pause step advancement at step 5 (environmental intensity surge) or on supply drops, allowing the operator to select a tactical resolution strategy (Option A, B, or C).
*   **Civilian Directed Evacuation**: Autonomous evacuation routes citizens via unblocked paths, adding `congestion_factor` penalties on traveled edges that slow down standard rescue vehicles.
*   **Low-Bandwidth signaling**: Compresses blocked edges and active havens into a tiny delta payload (e.g., `B:N_0_1_N_0_2|H:N_0_3`) matching Cell Broadcast and FM Radio RDS specifications.

---

## 10. Developer Execution & Verification

To run verification against these features, execute the regression test suite:
```bash
python C:\Users\dorni\.gemini\antigravity\brain\5b580ec4-5cb8-4b8e-a303-b6a236058c1f\scratch\regression_test.py
```
This suite verifies:
1. Mapped node naming and edge details (Phase 1).
2. Offline broadcast delta signaling (Phase 2).
3. Evacuation pathways, congestion factor updates, and strategic triggers pausing simulation (Phase 2).
4. Option resolution applying tactical benefits and unpausing step advancement (Phase 2).




