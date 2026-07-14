import os, re

# Fix Dijkstra cost string bug
dijkstra_file = 'backend/routing/confidence_dijkstra.py'
if os.path.exists(dijkstra_file):
    with open(dijkstra_file, 'r', encoding='utf-8') as f:
        content = f.read()
    content = content.replace("weight=f'cost_{vehicle_type}'", "weight='cost'")
    with open(dijkstra_file, 'w', encoding='utf-8') as f:
        f.write(content)

# Fix asyncio.run bugs in agents.py
agents_file = 'backend/api/agents.py'
if os.path.exists(agents_file):
    with open(agents_file, 'r', encoding='utf-8') as f:
        content = f.read()
    content = content.replace('asyncio.run(manager.broadcast(state))', '')
    content = content.replace('from backend.api.websocket import manager', '')
    with open(agents_file, 'w', encoding='utf-8') as f:
        f.write(content)

# Fix asyncio.run bugs in world.py
world_file = 'backend/api/world.py'
if os.path.exists(world_file):
    with open(world_file, 'r', encoding='utf-8') as f:
        content = f.read()
    content = content.replace('asyncio.run(manager.broadcast({"type": "world_update"}))', '')
    content = content.replace('from backend.api.websocket import manager', '')
    with open(world_file, 'w', encoding='utf-8') as f:
        f.write(content)

print("Final deep-logic fixes applied.")
