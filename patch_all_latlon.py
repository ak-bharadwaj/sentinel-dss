import os
import re

def patch_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Skipping {filepath} due to {e}")
        return

    new_content = re.sub(r"\b(\w+)\.get\('lat'\)", r"\1.get('y', \1.get('lat'))", content)
    new_content = re.sub(r"\b(\w+)\.get\('lon'\)", r"\1.get('x', \1.get('lon'))", new_content)
    
    new_content = re.sub(r"\b(\w+)\.get\('lat',\s*([^)]+)\)", r"\1.get('y', \1.get('lat', \2))", new_content)
    new_content = re.sub(r"\b(\w+)\.get\('lon',\s*([^)]+)\)", r"\1.get('x', \1.get('lon', \2))", new_content)

    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Patched: {filepath}")

for root, _, files in os.walk('backend'):
    for file in files:
        if file.endswith('.py'):
            patch_file(os.path.join(root, file))

print("Done patching.")
