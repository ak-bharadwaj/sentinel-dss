import os

main_py_path = 'backend/main.py'
if os.path.exists(main_py_path):
    with open(main_py_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Revert SlowAPI and HTTPS Redirect imports
    new_imports = """
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from backend.core.chaos import ChaosMiddleware
"""
    if new_imports in content:
        content = content.replace(new_imports, "\nfrom backend.core.chaos import ChaosMiddleware\n")
    
    # Alternatively, just use string replacement on the setup code block
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
    new_setup_code = """
# Chaos Engineering Middleware (Phase 5)
# Set enabled=True to inject latency and simulate database drops
app.add_middleware(ChaosMiddleware, enabled=True)
"""
    if setup_code in content:
        content = content.replace(setup_code, new_setup_code)

    # Revert CORS
    new_cors = """app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://your-production-domain.com"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)"""
    old_cors = """app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)"""
    if new_cors in content:
        content = content.replace(new_cors, old_cors)

    with open(main_py_path, 'w', encoding='utf-8') as f:
        f.write(content)

print("Phase 6 rollback applied.")
