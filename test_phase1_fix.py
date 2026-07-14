import os, re

node_file = 'backend/world_model/node.py'
if os.path.exists(node_file):
    with open(node_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Revert all Column(Boolean, default=False) back to Integer except for is_tall_building_zone
    content = content.replace('Column(Boolean, default=False)', 'Column(Integer, default=0)')
    
    # Make ONLY is_tall_building_zone Boolean
    content = re.sub(r'is_tall_building_zone = Column\(Integer, default=0\)', 'is_tall_building_zone = Column(Boolean, default=False)', content)
    
    if 'Boolean' not in content:
        content = content.replace('from sqlalchemy import Column, Integer, Float, String', 'from sqlalchemy import Column, Integer, Float, String, Boolean')
    
    with open(node_file, 'w', encoding='utf-8') as f:
        f.write(content)

print("Fixed node.py")
