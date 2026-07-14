import json
import os

transcript_path = r'C:\Users\dorni\.gemini\antigravity\brain\bfb1ae80-3e07-4554-b6a5-b08058a517e1\.system_generated\logs\transcript.jsonl'

versions = []
with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            if data.get('type') == 'PLANNER_RESPONSE' and 'tool_calls' in data:
                for call in data['tool_calls']:
                    if call['name'] == 'write_to_file':
                        args = call.get('args', {})
                        if 'MapView.js' in args.get('TargetFile', ''):
                            versions.append(args.get('CodeContent', ''))
                    elif call['name'] == 'replace_file_content' or call['name'] == 'multi_replace_file_content':
                        pass # just write to file is what I want if it's the full file
        except Exception as e:
            pass

# Write the last known full version if found
found = False
for i, v in enumerate(reversed(versions)):
    if len(v) > 30000: # It's about 50KB
        with open('recovered_mapview.js', 'w', encoding='utf-8') as f:
            f.write(v)
        print(f"Recovered version of size {len(v)} bytes!")
        found = True
        break

if not found:
    print("Could not find a full version in write_to_file calls.")
