import os, re

# Fix Pydantic schemas in simulation.py
schema_file = 'backend/schemas/simulation.py'
if os.path.exists(schema_file):
    with open(schema_file, 'r', encoding='utf-8') as f:
        content = f.read()
    content = content.replace("custom_shelters: list = []", "custom_shelters: list[CustomLocation] = Field(default_factory=list)")
    content = content.replace("custom_hospitals: list = []", "custom_hospitals: list[CustomLocation] = Field(default_factory=list)")
    if 'from pydantic import BaseModel, Field' not in content:
        content = content.replace('from pydantic import BaseModel', 'from pydantic import BaseModel, Field')
    with open(schema_file, 'w', encoding='utf-8') as f:
        f.write(content)

# Fix Pydantic config in core/config.py
config_file = 'backend/core/config.py'
if os.path.exists(config_file):
    with open(config_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    old_class = '''    class Config:
        case_sensitive = True'''
    new_class = '''    model_config = SettingsConfigDict(case_sensitive=True)'''
    content = content.replace(old_class, new_class)
    
    if 'SettingsConfigDict' not in content:
        content = content.replace('from pydantic_settings import BaseSettings', 'from pydantic_settings import BaseSettings, SettingsConfigDict')
        
    with open(config_file, 'w', encoding='utf-8') as f:
        f.write(content)

print("Phase 1 patches applied.")
