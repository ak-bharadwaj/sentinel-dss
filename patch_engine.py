import re

with open('backend/simulation/engine.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(".get('lat')", ".get('y', .get('lat'))".replace(".get('lat')", "get('lat')")) # wait, that's broken syntax
# Let's just do an exact string replace
content = content.replace("world_state.ground_truth.nodes[agent.current_node].get('lat')", "world_state.ground_truth.nodes[agent.current_node].get('y', world_state.ground_truth.nodes[agent.current_node].get('lat'))")
content = content.replace("world_state.ground_truth.nodes[agent.current_node].get('lon')", "world_state.ground_truth.nodes[agent.current_node].get('x', world_state.ground_truth.nodes[agent.current_node].get('lon'))")

with open('backend/simulation/engine.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("engine.py patched.")
