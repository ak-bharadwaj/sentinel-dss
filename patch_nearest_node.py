import re

with open('backend/world_model/world_state.py', 'r') as f:
    content = f.read()

content = content.replace("n_lat = node_data.get('lat')", "n_lat = node_data.get('y', node_data.get('lat'))")
content = content.replace("n_lon = node_data.get('lon')", "n_lon = node_data.get('x', node_data.get('lon'))")

with open('backend/world_model/world_state.py', 'w') as f:
    f.write(content)

print("Nearest node patched.")
