import os

node_file = 'backend/world_model/node.py'
if os.path.exists(node_file):
    with open(node_file, 'r', encoding='utf-8') as f:
        content = f.read()
    content = content.replace('Column(Integer, default=0)', 'Column(Boolean, default=False)')
    with open(node_file, 'w', encoding='utf-8') as f:
        f.write(content)

world_file = 'backend/world_model/world_state.py'
if os.path.exists(world_file):
    with open(world_file, 'r', encoding='utf-8') as f:
        content = f.read()
    content = content.replace('int(n_data.get("is_tall_building_zone", False))', 'bool(n_data.get("is_tall_building_zone", False))')
    with open(world_file, 'w', encoding='utf-8') as f:
        f.write(content)

print("Phase 1 SQL schema casting patch applied.")
