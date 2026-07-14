import re

with open('backend/api/simulation.py', 'r') as f:
    content = f.read()

content = content.replace("node_data.get('lat', 0)", "node_data.get('y', node_data.get('lat', 0))")
content = content.replace("node_data.get('lon', 0)", "node_data.get('x', node_data.get('lon', 0))")

with open('backend/api/simulation.py', 'w') as f:
    f.write(content)

print("simulation.py nearest node patched.")
