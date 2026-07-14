import re

with open('backend/api/simulation.py', 'r') as f:
    content = f.read()

new_endpoint = """
@router.post("/move_unit")
def move_unit(request: dict, lock: SimLockDep):
    unit_id = request.get("id")
    unit_type = request.get("type") # "agent" or "node"
    new_lat = request.get("lat")
    new_lon = request.get("lon")
    
    with lock:
        if unit_type == "agent":
            if unit_id in simulation_engine.agents:
                agent = simulation_engine.agents[unit_id]
                node_id = world_state.get_nearest_node(new_lat, new_lon)
                if node_id:
                    agent.current_node = node_id
                    agent.current_lat = world_state.belief.nodes[node_id]["y"]
                    agent.current_lon = world_state.belief.nodes[node_id]["x"]
                    agent.path = [] # Reset path
                    return {"status": "success", "message": f"Agent {unit_id} moved"}
        elif unit_type == "node":
            # For havens/hospitals, moving is basically removing old and adding new
            pass
            
    return {"status": "error", "message": "Unit not moved"}
"""

content += new_endpoint
with open('backend/api/simulation.py', 'w') as f:
    f.write(content)
print("Endpoint added.")
