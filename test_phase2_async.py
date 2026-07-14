import os, re

def remove_asyncio_manager(filepath):
    if not os.path.exists(filepath): return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    content = re.sub(r'asyncio\.run\(manager\.broadcast\(.*?\)\)', '', content)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

remove_asyncio_manager('backend/api/agents.py')
remove_asyncio_manager('backend/api/world.py')

print("Phase 2 async bugs fixed.")
