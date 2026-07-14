from fastapi import APIRouter
from backend.simulation.engine import simulation_engine

import asyncio
from backend.world_model.world_state import world_state

router = APIRouter(prefix="/agents", tags=["Agents"])

def _compute_route_geometry(agent):
    """
    Pre-computes the full road-accurate [lat, lon] coordinate path for an agent's
    planned route by stitching together OSM edge geometry segments.
    Returns a list of [lat, lon] pairs, or [] if no route.
    """
    route_nodes = []
    if agent.full_planned_route and len(agent.full_planned_route) >= 2:
        route_nodes = list(agent.full_planned_route)
    else:
        if agent.current_node:
            route_nodes.append(agent.current_node)
        if agent.next_node and agent.next_node != agent.current_node:
            route_nodes.append(agent.next_node)
        if agent.route:
            for node in agent.route:
                if not route_nodes or node != route_nodes[-1]:
                    route_nodes.append(node)

    if len(route_nodes) < 2:
        return []

    belief = world_state.belief
    path_coords = []

    for i in range(len(route_nodes) - 1):
        u = route_nodes[i]
        v = route_nodes[i + 1]

        # Try to get OSM edge geometry (handles both directions)
        geom = None
        if belief.has_edge(u, v):
            edge_data = belief.edges[u, v]
            geom = edge_data.get("geometry")
            if geom and len(geom) >= 2:
                # Geometry stored as [lat, lon] pairs from source→target
                src = edge_data.get("edge_source") or u
                if src == u:
                    coords = geom
                else:
                    coords = list(reversed(geom))
                for idx, coord in enumerate(coords):
                    if idx == 0 and path_coords:
                        continue  # skip duplicate node
                    path_coords.append(coord)
                continue

        # Fallback: straight line between node lat/lon
        u_data = belief.nodes.get(u, {})
        v_data = belief.nodes.get(v, {})
        u_lat, u_lon = u_data.get("lat"), u_data.get("lon")
        v_lat, v_lon = v_data.get("lat"), v_data.get("lon")
        if u_lat is not None and v_lat is not None:
            if not path_coords:
                path_coords.append([u_lat, u_lon])
            path_coords.append([v_lat, v_lon])

    return path_coords


@router.get("")
def get_agents():
    """Returns the current state, telemetry, and road-accurate route geometry of all agents."""
    result = []
    for agent in simulation_engine.agents.values():
        d = agent.to_dict()
        d["route_geometry"] = _compute_route_geometry(agent)
        
        # Pre-compute current edge geometry for smooth frontend interpolation
        if agent.current_node and agent.next_node and agent.current_node != agent.next_node:
            u, v = agent.current_node, agent.next_node
            if world_state.belief.has_edge(u, v):
                edge_data = world_state.belief.edges[u, v]
                geom = edge_data.get("geometry")
                if geom and len(geom) >= 2:
                    src = edge_data.get("edge_source") or u
                    d["current_edge_geometry"] = geom if src == u else list(reversed(geom))
        result.append(d)
        
    import json
    
    payload_str = json.dumps(result)
    payload_size = len(payload_str.encode('utf-8'))
    
    if payload_size > 5 * 1024 * 1024:
        print(f"[TELEMETRY] GET /agents Payload {payload_size} bytes exceeds 5MB. Downsampling geometry.")
        for agent_d in result:
            if "route_geometry" in agent_d and isinstance(agent_d["route_geometry"], list):
                agent_d["route_geometry"] = agent_d["route_geometry"][::10]
        payload_str = json.dumps(result)
        if len(payload_str.encode('utf-8')) > 5 * 1024 * 1024:
            for agent_d in result:
                agent_d["route_geometry"] = []
                agent_d["current_edge_geometry"] = []
            payload_str = json.dumps(result)
            
    return json.loads(payload_str)

from pydantic import BaseModel
class AgentDispatchSchema(BaseModel):
    agent_id: str
    target_node_id: str

@router.post("/dispatch")
def dispatch_agent(config: AgentDispatchSchema):
    """Manually dispatches an agent to a target node."""
    if config.agent_id not in simulation_engine.agents:
        return {"status": "Error", "message": "Agent not found."}
        
    agent = simulation_engine.agents[config.agent_id]
    
    # Calculate safest/shortest path from agent's current position to target node
    from backend.routing.confidence_dijkstra import find_confidence_route
    route_info = find_confidence_route(world_state.belief, agent.current_node, config.target_node_id)
    
    if not route_info:
        return {"status": "Error", "message": "No traversable path found to target node"}
        
    path, dist, _ = route_info
    
    # Pop the first element since it's the current node
    if path and path[0] == agent.current_node:
        path.pop(0)
        
    from backend.agents.base_agent import AgentStatus
    agent.target_node = config.target_node_id
    agent.route = path
    agent.full_planned_route = [agent.current_node] + path
    agent.status = AgentStatus.MOVING
    agent.progress_on_edge = 0.0
    agent.next_node = None
    agent.is_manual_override = True
    
    simulation_engine.add_event(f"[COMMAND] Override: {config.agent_id} retasking to {config.target_node_id}.")
    
    return {
        "status": "Success",
        "agent_id": config.agent_id,
        "target_node_id": config.target_node_id,
        "path_length": len(path)
    }

@router.post("/rtb_all")
def global_rtb():
    """Triggers global RTB for all active agents."""
    success = simulation_engine.trigger_global_rtb()
    if success:
        return {"status": "Success", "message": "Global RTB triggered."}
    return {"status": "Error", "message": "Failed to trigger RTB. No safe havens found."}

class AgentCancelSchema(BaseModel):
    agent_id: str

@router.post("/cancel_override")
def cancel_override(config: AgentCancelSchema):
    """Cancels manual dispatch overrides for an agent, returning control back to coordinator."""
    if config.agent_id not in simulation_engine.agents:
        return {"status": "Error", "message": "Agent not found"}
    agent = simulation_engine.agents[config.agent_id]
    agent.is_manual_override = False
    
    from backend.agents.base_agent import AgentStatus
    agent.status = AgentStatus.IDLE
    agent.target_node = None
    agent.route = []
    agent.full_planned_route = []
    simulation_engine.add_event(f"[{simulation_engine.simulation_time}m] 🤖 Operator released manual override for {config.agent_id}. Auto-coordinator control active.")
    return {"status": "Success", "agent_id": config.agent_id}
