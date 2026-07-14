import os
import re

transcript_path = r'C:\Users\dorni\.gemini\antigravity\brain\bfb1ae80-3e07-4554-b6a5-b08058a517e1\.system_generated\logs\transcript.jsonl'

full_content = None

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        # We look for the literal string that might be inside a JSON payload.
        if "export default function MapView" in line and "leafletMap.current" in line and "L.map" in line and "layersRef.current" in line:
            # We found a line with MapView in it!
            # Let's try to extract it. Since it's a JSON string, we can try to extract everything between `export default function MapView` and `</MapView>` or just dump the whole JSON line to a temp file.
            pass

print("Searching using string matching...")
best_match = ""

with open(transcript_path, 'r', encoding='utf-8') as f:
    content = f.read()
    
    # Let's find all occurrences of "import { useEffect, useRef, useState } from \"react\";\nimport \"leaflet/dist/leaflet.css\";\n\nexport default function MapView"
    pattern = r'(import \{ useEffect, useRef, useState \} from \\"react\\";\\nimport \\"leaflet/dist/leaflet\.css\\";\\n\\nexport default function MapView.*?)(?=\\",|\\"\}|\\"\]|\\n\\nNOTE:)'
    
    matches = re.findall(pattern, content, flags=re.DOTALL)
    for m in matches:
        # replace escaped newlines with actual newlines
        decoded = m.replace('\\n', '\n').replace('\\"', '"').replace('\\\\', '\\').replace('\\r', '\r').replace('\\t', '\t')
        if len(decoded) > len(best_match) and len(decoded) > 10000:
            best_match = decoded

if best_match:
    with open('recovered_mapview.js', 'w', encoding='utf-8') as out:
        out.write(best_match)
    print(f"Recovered {len(best_match)} bytes!")
else:
    print("No valid matches found.")
