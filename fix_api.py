import sys

file_path = 'c:/Users/dorni/OneDrive/Desktop/project/backend/api/simulation.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

search_str = """    result = {
        "status": "Success",
        "step": simulation_engine.simulation_time,
        "survivors_saved": simulation_engine.total_survivors_saved,
        "active_baseline": simulation_engine.active_baseline,
        "coverage": simulation_engine.history[-1]["coverage"] if simulation_engine.history else 0.0,
        "map_confidence": simulation_engine.history[-1]["map_confidence"] if simulation_engine.history else 1.0,
        "agents": agents_data,
        "events": simulation_engine.pop_new_events(),
        "stage_complete": stage_complete,
        "replanning_required": replanning_req
    }"""

replace_str = """    result = {
        "status": "Success",
        "step": simulation_engine.simulation_time,
        "survivors_saved": simulation_engine.total_survivors_saved,
        "active_baseline": simulation_engine.active_baseline,
        "coverage": simulation_engine.history[-1]["coverage"] if simulation_engine.history else 0.0,
        "map_confidence": simulation_engine.history[-1]["map_confidence"] if simulation_engine.history else 1.0,
        "agents": agents_data,
        "events": simulation_engine.pop_new_events(),
        "stage_complete": stage_complete,
        "replanning_required": replanning_req,
        "replanning_reason": getattr(simulation_engine, 'replanning_reason', None),
        "telemetry": getattr(simulation_engine, 'last_telemetry', {})
    }
    simulation_engine.replanning_reason = None  # clear after sending"""

content = content.replace(search_str, replace_str)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
