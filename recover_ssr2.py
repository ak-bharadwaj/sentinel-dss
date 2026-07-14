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
                print(f"Found {source} with length {len(content)}")
except Exception as e:
    print(e)
