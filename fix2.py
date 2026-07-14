import sys

with open('c:/Users/dorni/OneDrive/Desktop/project/frontend/app/page.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace aside with leftSidebarOpen && <section>
content = content.replace('<aside className="panel-left">', '{leftSidebarOpen && (\n        <section className="panel-left">')

# Remove stray </>
content = content.replace('          </>\n', '')

with open('c:/Users/dorni/OneDrive/Desktop/project/frontend/app/page.js', 'w', encoding='utf-8') as f:
    f.write(content)
