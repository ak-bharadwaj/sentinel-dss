import json
import re

path = r'C:\Users\dorni\OneDrive\Desktop\project\frontend\.next\server\chunks\ssr\_0fgur__._.js.map'

try:
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    found = False
    if 'sources' in data and 'sourcesContent' in data:
        for i, source in enumerate(data['sources']):
            if 'MapView.js' in source:
                content = data['sourcesContent'][i]
                if content and len(content) > 30000:
                    with open(r'C:\Users\dorni\OneDrive\Desktop\project\recovered_mapview.js', 'w', encoding='utf-8') as out:
                        out.write(content)
                    print(f"Recovered {len(content)} bytes from {source}!")
                    found = True
                    break
    if not found:
        print("Could not find MapView.js with length > 30k in this sourcemap.")
except Exception as e:
    print(e)
