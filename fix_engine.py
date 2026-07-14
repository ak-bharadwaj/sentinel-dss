import sys
import re

file_path = 'c:/Users/dorni/OneDrive/Desktop/project/backend/simulation/engine.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add time import if not present
if "import time" not in content:
    content = content.replace("import math", "import math\nimport time")

# Inject perf timers in step()
# 1. Physics starts right after step() definition
content = content.replace(
    '        # --- 1. POPULATION DECAY & TRIAGE CLASSIFICATION (Ground Truth) ---',
    '        t_physics_start = time.perf_counter()\n        # --- 1. POPULATION DECAY & TRIAGE CLASSIFICATION (Ground Truth) ---'
)

# 2. Belief starts after Comms blackout checks
content = content.replace(
    '        # --- 2. DECAY INFORMATION (Belief) ---',
    '        t_physics_end = time.perf_counter()\n        self.last_telemetry["physics_ms"] = (t_physics_end - t_physics_start) * 1000\n\n        t_belief_start = time.perf_counter()\n        # --- 2. DECAY INFORMATION (Belief) ---'
)

# 3. Decision/Allocation starts at Coordinator Allocation
content = content.replace(
    '        # --- 3. COORDINATOR ALLOCATION ---',
    '        t_belief_end = time.perf_counter()\n        self.last_telemetry["belief_ms"] = (t_belief_end - t_belief_start) * 1000\n\n        t_alloc_start = time.perf_counter()\n        # --- 3. COORDINATOR ALLOCATION ---'
)

# 4. Simulation starts at Agent Actions
content = content.replace(
    '        # --- 4. EXECUTE AGENT ACTIONS & MOVEMENT ---',
    '        t_alloc_end = time.perf_counter()\n        self.last_telemetry["allocation_ms"] = (t_alloc_end - t_alloc_start) * 1000\n\n        t_sim_start = time.perf_counter()\n        # --- 4. EXECUTE AGENT ACTIONS & MOVEMENT ---'
)

# 5. End of step()
content = content.replace(
    '        # Capture metrics history',
    '        t_sim_end = time.perf_counter()\n        self.last_telemetry["routing_ms"] = (t_sim_end - t_sim_start) * 1000\n\n        # Capture metrics history'
)

# 6. Update tide replanning reason
content = content.replace(
    '            self.replanning_required = True\n            self.add_xai_event(',
    '            self.replanning_required = True\n            self.replanning_reason = f"Tide shift to {new_tide}"\n            self.add_xai_event('
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
