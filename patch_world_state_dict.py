import re

with open('backend/world_model/world_state.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace dict bracket access with .get()
content = content.replace("node_data['p_danger']", "node_data.get('p_danger', 0.0)")
content = content.replace("node_data['p_state_correct']", "node_data.get('p_state_correct', 1.0)")
content = content.replace("node_data['status']", "node_data.get('status', 'SAFE')")
content = content.replace("node_data['population']", "node_data.get('population', 0)")

with open('backend/world_model/world_state.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("world_state.py dictionary access patched.")
