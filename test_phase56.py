import os

main_py_path = 'backend/main.py'
if os.path.exists(main_py_path):
    with open(main_py_path, 'r', encoding='utf-8') as f:
        content = f.read()

    new_imports = """
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from backend.core.chaos import ChaosMiddleware
"""

    if 'slowapi' not in content:
        content = content.replace("from fastapi.middleware.cors import CORSMiddleware", "from fastapi.middleware.cors import CORSMiddleware" + new_imports)

    setup_code = """
# Rate Limiting Setup
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# HTTPS Enforcer (Disabled for local dev, enable in Prod)
# app.add_middleware(HTTPSRedirectMiddleware)

# Chaos Engineering Middleware (Phase 5)
# Set enabled=True to inject latency and simulate database drops
app.add_middleware(ChaosMiddleware, enabled=True)
"""

    if 'ChaosMiddleware' not in content.split('from backend.core')[0]:
        content = content.replace('app = FastAPI(title="Disaster Simulation API")', 'app = FastAPI(title="Disaster Simulation API")\n' + setup_code)
        
    # Fix CORS wildcards
    old_cors = """app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)"""
    new_cors = """app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://your-production-domain.com"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)"""
    content = content.replace(old_cors, new_cors)

    with open(main_py_path, 'w', encoding='utf-8') as f:
        f.write(content)

print("Phase 5 and 6 Main.py patches applied.")
