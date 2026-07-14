import os

file_path = 'backend/routing/confidence_dijkstra.py'
if os.path.exists(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # We need to replace the weight='cost' argument (which I set earlier) with a function
    # Let's find the nx.shortest_path call
    
    old_call = '''        path = nx.shortest_path(
            graph,
            source=source,
            target=target,
            weight='cost'
        )'''
    
    new_call = '''        def weight_func(u, v, d):
            return calculate_edge_cost(graph, u, v, d, vehicle_type)
            
        path = nx.shortest_path(
            graph,
            source=source,
            target=target,
            weight=weight_func
        )'''
        
    if "weight='cost'" in content:
        content = content.replace(old_call, new_call)
    elif "weight=f'cost_{vehicle_type}'" in content:
        content = content.replace('''        path = nx.shortest_path(
            graph,
            source=source,
            target=target,
            weight=f'cost_{vehicle_type}'
        )''', new_call)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

print("Phase 2 Dijkstra routing fix applied.")
