import os, re

# Fix map limits
map_file = 'frontend/components/MapView.js'
if os.path.exists(map_file):
    with open(map_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Add map options
    map_init_old = '''      L.map(mapRef.current, {
        center: [nodes[0]?.lat || 19.0760, nodes[0]?.lon || 72.8777],
        zoom: 13,
        zoomControl: false,
      })'''
    map_init_new = '''      L.map(mapRef.current, {
        center: [nodes[0]?.lat || 19.0760, nodes[0]?.lon || 72.8777],
        zoom: 13,
        zoomControl: false,
        minZoom: 10,
        maxZoom: 20
      })'''
    content = content.replace(map_init_old, map_init_new)
    
    with open(map_file, 'w', encoding='utf-8') as f:
        f.write(content)

# Fix CSS viewport
css_file = 'frontend/app/globals.css'
if os.path.exists(css_file):
    with open(css_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove google fonts import
    content = re.sub(r'@import url\([^)]+\);\n?', '', content)
    # Fix viewport height
    content = content.replace('height: 100vh;', 'height: 100dvh;')
    content = content.replace('width: 100vw;', 'width: 100%;')
    
    with open(css_file, 'w', encoding='utf-8') as f:
        f.write(content)

print("Phase 3 patches applied.")
