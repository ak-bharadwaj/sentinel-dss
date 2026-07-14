import os

config_file = 'backend/core/config.py'
if os.path.exists(config_file):
    with open(config_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if 'from pydantic_settings import BaseSettings, SettingsConfigDict' not in content:
        content = content.replace('from pydantic_settings import BaseSettings', 'from pydantic_settings import BaseSettings, SettingsConfigDict')
        
    with open(config_file, 'w', encoding='utf-8') as f:
        f.write(content)
        
print("Fixed missing import.")
