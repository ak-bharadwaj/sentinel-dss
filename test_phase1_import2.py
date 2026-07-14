import os, re

node_file = 'backend/world_model/node.py'
if os.path.exists(node_file):
    with open(node_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Add Boolean to the imports regardless
    if 'Boolean' not in content.split('from sqlalchemy')[1].split('\n')[0]:
        content = content.replace('from sqlalchemy import Column, Integer, Float, String', 'from sqlalchemy import Column, Integer, Float, String, Boolean')
    
    with open(node_file, 'w', encoding='utf-8') as f:
        f.write(content)

print("Fixed node.py import")
