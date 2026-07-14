import sys

with open('c:/Users/dorni/OneDrive/Desktop/project/frontend/app/page.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Add the </> back before the `)}` of isLegendOpen
search_str = """                    <span>Comms Blackout</span>
                  </div>
                )}
            </div>"""

replace_str = """                    <span>Comms Blackout</span>
                  </div>
                </>
              )}
            </div>"""

content = content.replace(search_str, replace_str)

with open('c:/Users/dorni/OneDrive/Desktop/project/frontend/app/page.js', 'w', encoding='utf-8') as f:
    f.write(content)
