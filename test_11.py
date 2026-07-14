import requests
import time

def test_full_lifecycle():
    try:
        print('[TEST] 1. Starting Simulation...')
        res = requests.post('http://127.0.0.1:8000/api/simulation/start', json={'lat': 19.076, 'lon': 72.8777, 'span': 0.05, 'map_mode': 'SYNTHETIC'}, timeout=20)
        print(f"Status: {res.status_code}")
        
        print('[TEST] 2-4. Deploying Units (Resources)...')
        res = requests.post('http://127.0.0.1:8000/api/simulation/deploy_units', json={'havens':[{'lat':19.076,'lon':72.877}], 'hospitals':[], 'scouts':[{'lat':19.076,'lon':72.877, 'vehicle_type': 'SCOUT_CAR'}], 'rescues':[{'lat':19.076,'lon':72.877, 'vehicle_type': 'HELICOPTER'}]}, timeout=20)
        print(f"Status: {res.status_code}")

        print('[TEST] 5. Planning Phase...')
        res = requests.post('http://127.0.0.1:8000/api/simulation/plan_phase', timeout=60)
        print(f"Status: {res.status_code}")
        
        print('[TEST] 6. Execute Phase...')
        res = requests.post('http://127.0.0.1:8000/api/simulation/execute_phase', timeout=10)
        print(f"Status: {res.status_code}")

        print('[TEST] 7-10. Running Steps (Live Ops)...')
        replanning_hit = False
        for i in range(1, 10):
            res = requests.post('http://127.0.0.1:8000/api/simulation/step', timeout=10)
            data = res.json()
            print(f"Step {i}: Agents: {len(data.get('agents', []))}, Replanning Req: {data.get('replanning_required')}")
            if data.get('replanning_required'):
                replanning_hit = True
            time.sleep(0.1)
        
        print('[TEST] 11. Checking AAR CSV Export...')
        res = requests.get('http://127.0.0.1:8000/api/analytics/export_csv', timeout=10)
        print(f"Status: {res.status_code}")
        
        print('DONE')
    except Exception as e:
        print(f"ERROR: {e}")

test_full_lifecycle()
