import sys

data = open('c:/Users/dorni/OneDrive/Desktop/project/frontend/app/page.js', encoding='utf-8').read()
data = data.replace('dY"?', '📍')
data = data.replace('dY>,?', '🛡️')
data = data.replace('dY?', '🏥')
open('c:/Users/dorni/OneDrive/Desktop/project/frontend/app/page.js', 'w', encoding='utf-8').write(data)
