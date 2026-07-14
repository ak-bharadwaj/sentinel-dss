import os
import json

found = False
for root, dirs, files in os.walk(r'C:\Users\dorni\OneDrive\Desktop\project\frontend\.next'):
    for file in files:
        if file.endswith('.map'):
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    
                if 'sources' in data and 'sourcesContent' in data:
                    for i, source in enumerate(data['sources']):
                        if 'MapView.js' in source:
                            content = data['sourcesContent'][i]
                            if content and len(content) > 30000:
                                with open(r'C:\Users\dorni\OneDrive\Desktop\project\recovered_mapview.js', 'w', encoding='utf-8') as out:
                                    out.write(content)
                                print(f"Recovered {len(content)} bytes from {path}!")
                                found = True
                                break
            except:
                pass
        if found: break
    if found: break

if not found:
    print("Could not find MapView.js in sourcemaps.")
