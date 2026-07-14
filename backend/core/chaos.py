import random
import asyncio
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import logging

logger = logging.getLogger(__name__)

class ChaosMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, enabled: bool = False):
        super().__init__(app)
        self.enabled = enabled

    async def dispatch(self, request: Request, call_next):
        if not self.enabled:
            return await call_next(request)

        # 1. Network Latency Spike (10% chance to delay 1-3 seconds)
        if random.random() < 0.10:
            delay = random.uniform(1.0, 3.0)
            logger.warning(f"CHAOS: Injecting {delay:.2f}s latency on {request.url.path}")
            await asyncio.sleep(delay)

        # 2. Database Unavailable / API Crash (5% chance)
        if random.random() < 0.05:
            logger.error(f"CHAOS: Simulating Service Unavailable on {request.url.path}")
            return JSONResponse(status_code=503, content={"detail": "Service Unavailable - Chaos Engine"})
            
        # 3. Bad Gateway (5% chance)
        if random.random() < 0.05:
            logger.error(f"CHAOS: Simulating Bad Gateway on {request.url.path}")
            return JSONResponse(status_code=502, content={"detail": "Bad Gateway - Chaos Engine"})

        response = await call_next(request)
        return response
