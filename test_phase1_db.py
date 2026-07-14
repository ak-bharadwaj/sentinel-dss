import os

# Fix database.py SQLite concurrency
db_file = 'backend/database.py'
if os.path.exists(db_file):
    with open(db_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    old_sqlite = '''if settings.DB_ENGINE == "sqlite":
    # Required for sqlite to allow multi-threaded FastAPI queries
    connect_args = {"check_same_thread": False}'''
    
    new_sqlite = '''from sqlalchemy import event
from sqlalchemy.engine import Engine

if settings.DB_ENGINE == "sqlite":
    connect_args = {"check_same_thread": False, "timeout": 15}'''
    
    content = content.replace(old_sqlite, new_sqlite)
    
    pragma_code = '''
@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if settings.DB_ENGINE == "sqlite":
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()
'''
    if 'PRAGMA journal_mode=WAL' not in content:
        content += pragma_code
        
    with open(db_file, 'w', encoding='utf-8') as f:
        f.write(content)

print("Database concurrency patch added.")
