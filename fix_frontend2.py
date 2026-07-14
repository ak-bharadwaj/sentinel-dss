import sys

file_path = 'c:/Users/dorni/OneDrive/Desktop/project/frontend/app/page.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("            )}\n              </div>\n              )}\n              {telemetry && (", "            )}\n              {telemetry && (")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
