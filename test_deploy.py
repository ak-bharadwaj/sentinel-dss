import requests

print("Starting simulation...")
res = requests.post('http://127.0.0.1:8000/api/simulation/start', json={'lat': 19.076, 'lon': 72.8777, 'span': 0.05, 'map_mode': 'SYNTHETIC'})
print('Start:', res.json())

print("Deploying units...")
res = requests.post('http://127.0.0.1:8000/api/simulation/deploy_units', json={'havens':[],'hospitals':[],'scouts':[{'lat':19.076,'lon':72.877}],'rescues':[]})
print('Deploy:', res.json())

print("Fetching agents...")
agents = requests.get('http://127.0.0.1:8000/api/agents').json()
print('Agents:', [a.get('id') for a in agents])

print("Fetching world...")
world = requests.get('http://127.0.0.1:8000/api/world').json()
coordinates = world.get('coordinates', {})
print("Num coordinates:", len(coordinates))

for a in agents:
    node = a.get('current_node')
    print('Agent at node', node, 'Found in coords:', str(node) in coordinates)
