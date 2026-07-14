import re

transcript_path = r'C:\Users\dorni\.gemini\antigravity\brain\bfb1ae80-3e07-4554-b6a5-b08058a517e1\.system_generated\logs\transcript.jsonl'

best_match = ""

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        # Find all JSON string literals that might be a file content
        # We can just use a simple heuristic: if a chunk of the line contains "export default function MapView" and "return (" and "layersRef", it's probably the file.
        if "export default function MapView" in line and "layersRef" in line:
            # extract string literals
            strings = re.findall(r'"([^"\\]*(?:\\.[^"\\]*)*)"', line)
            for s in strings:
                if "export default function MapView" in s and "layersRef" in s:
                    decoded = s.encode('utf-8').decode('unicode_escape')
                    if len(decoded) > len(best_match):
                        best_match = decoded

if best_match:
    with open('recovered_mapview.js', 'w', encoding='utf-8') as out:
        out.write(best_match)
    print(f"Recovered {len(best_match)} bytes!")
else:
    print("No valid matches found.")
