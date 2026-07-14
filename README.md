# Sentinel Command: Autonomous Disaster Response System

Sentinel is an agentic AI-driven disaster response decision support engine. It features dynamic prior hazard prediction, intent-driven drone scouting, real-time pathfinding on corrupted graphs, and a dynamic rolling horizon objective planning system.

---

## 🛠️ System Components & Architecture

The application is structured into a modern dual-stack architecture:
1. **Backend**: Built with **FastAPI**, **SQLAlchemy** (SQLite database), and **NetworkX** (graph topology). Contains the simulation loop, vehicle physics, agent behavior, and routing algorithms.
2. **Frontend**: A high-fidelity, responsive **Next.js** dashboard using vanilla Leaflet for high-performance canvas-based map rendering.

---

## 🚀 Setup & Launch Instructions

### 1. Start the Backend Server
From the project root:
```bash
# Activate your python environment if necessary, then run:
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
The API Swagger documentation will be available at `http://127.0.0.1:8000/docs`.

### 2. Start the Frontend Dev Server
From the `frontend` folder:
```bash
cd frontend
npm run dev
```
Open `http://localhost:3000` in your web browser.

---

## 📖 Key Features & New Implementations

### Phase 1: High-Value Targets & Human-Readable Naming
*   **HVT Detour Prioritization**: Blocked segments are dynamically ranked based on the counter-factual detour time saved and the trapped population density:
    $$\text{HVT Priority} = \text{Detour Time Saved} \times \text{Trapped Population}$$
*   **Dynamic Intersection Naming**: Node numbers are dynamically mapped to readable street intersections (e.g. `"Avenue 1 & Street A Junction"`) using OSM edge tags. Special nodes render as landmark labels (e.g., `"Shelter / Safe Haven"`).

### Phase 2: Strategic Command Decisions & Civilian Evacuation
*   **Strategic Trigger & Pause**: The engine pauses step advancement when critical triggers fire (e.g. step 5 environmental intensity shifts, or when haven food/water falls below 20%). It prompts the operator with 3 strategic options:
    *   **Option A (Safe Route)**: Directs vehicles to prioritize low-danger segments by scaling risk weights to 5x.
    *   **Option B (Air Bridge)**: replenish supplies at low havens via helicopter cargo drops.
    *   **Option C (Scout & Clear)**: Directs crews to clear blockages, reducing edge traversal speed penalties.
*   **Directed Evacuation Broadcast**: Enabling this mode broadcast offline delta signal packages, guiding citizens to autonomously route to safe havens using unblocked paths, introducing localized road congestion.
*   **Crowdsourced Stuck Alerts**: Isolated citizens locked by surrounding blockages send low-frequency SMS alerts after 3 steps, automatically updating the EOC belief graph.
*   **Offline Delta Signaling**: Encodes blocked roads and active havens into a compact text format (under 50 bytes) fit for Cell Broadcast or FM Radio RDS (e.g., `B:N_1_2,N_3_4|H:N_0_3`).
