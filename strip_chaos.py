import os

main_py_path = 'backend/main.py'
if os.path.exists(main_py_path):
    with open(main_py_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    clean_lines = []
    for line in lines:
        if 'ChaosMiddleware' in line:
            continue
        clean_lines.append(line)

    with open(main_py_path, 'w', encoding='utf-8') as f:
        f.writelines(clean_lines)

print("ChaosMiddleware permanently removed from main.py for demo stability.")
