import re

path = 'backend/api/simulation.py'
with open(path, 'r') as f:
    content = f.read()

delete_endpoints = """
@router.post("/remove_unit")
def remove_unit(request: dict, lock: SimLockDep):
    unit_id = request.get("id")
    unit_type = request.get("type") # "agent" or "node"
    
    with lock:
        if unit_type == "agent":
            if unit_id in simulation_engine.agents:
                del simulation_engine.agents[unit_id]
                return {"status": "success", "message": f"Agent {unit_id} removed"}
        elif unit_type == "node":
            if unit_id in world_state.belief.nodes:
                world_state.belief.nodes[unit_id]["node_type"] = "NORMAL"
                world_state.ground_truth.nodes[unit_id]["node_type"] = "NORMAL"
                return {"status": "success", "message": f"Haven {unit_id} removed"}
    return {"status": "error", "message": "Unit not found"}
"""

if "def remove_unit" not in content:
    content += delete_endpoints
    with open(path, 'w') as f:
        f.write(content)
    print("Backend endpoints added")
