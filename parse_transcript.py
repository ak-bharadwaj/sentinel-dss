import json

# Search transcript for the original page content with 'select your tactical deployment area'
transcript_path = r'C:\Users\dorni\.gemini\antigravity\brain\5b580ec4-5cb8-4b8e-a303-b6a236058c1f\.system_generated\logs\transcript.jsonl'
f = open(transcript_path, encoding='utf-8')
out = open('original_setup.txt', 'w', encoding='utf-8')
count = 0
for line in f:
    try:
        obj = json.loads(line)
        step = obj.get('step_index', 0)
        content = obj.get('content', '')
        # Find content with the original location page markers
        if ('select your tactical' in content.lower() or 
            'mumbai' in content.lower() and 'new york' in content.lower() or
            'isInitialized' in content and 'lat' in content.lower()):
            out.write('=== step=' + str(step) + ' type=' + obj.get('type','') + ' ===\n')
            # Find relevant section
            idx = content.lower().find('select your tactical')
            if idx < 0:
                idx = content.lower().find('isinitial')
            start = max(0, idx - 200)
            out.write(content[start:start+10000])
            out.write('\n\n')
            count += 1
        # Also check tool_calls
        for tc in obj.get('tool_calls', []):
            args_raw = tc.get('arguments', '') or tc.get('function', {}).get('arguments', '')
            args = str(args_raw)
            if ('select your tactical' in args.lower() or
                ('mumbai' in args.lower() and 'custom' in args.lower() and 'lat' in args.lower())):
                out.write('=== TOOL step=' + str(step) + ' ===\n')
                out.write(args[:12000])
                out.write('\n\n')
                count += 1
    except Exception as e:
        pass
out.close()
f.close()
print('found', count, 'entries')
