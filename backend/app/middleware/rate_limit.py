"""Rate limiting middleware — per-user and per-IP limits via Redis."""

from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.services.redis_service import redis_service


# Rate limit configuration: endpoint_prefix -> (requests, window_seconds)
RATE_LIMITS = {
    "/api/calls/start": (10, 60),       # 10 calls/min
    "/api/voice/clone": (5, 3600),       # 5 clones/hour
    "/api/chats/dm": (30, 60),           # 30 DM creates/min
    "/api/chats/group": (10, 60),        # 10 groups/min
    "/api/friends/request": (20, 60),    # 20 friend requests/min
    "/api/auth/signup": (5, 3600),       # 5 signups/hour per IP
    "/api/auth/login": (30, 60),         # 30 login attempts/min per IP
}

# Global default: 200 requests/min per user
DEFAULT_LIMIT = (200, 60)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Redis-backed sliding window rate limiter."""

    async def dispatch(self, request: Request, call_next):
        # Skip health checks and static assets
        path = request.url.path
        if path in ("/health", "/docs", "/openapi.json", "/redoc"):
            return await call_next(request)

        # Only rate-limit API endpoints
        if not path.startswith("/api"):
            return await call_next(request)

        try:
            # Determine identifier: user token or IP
            auth_header = request.headers.get("authorization", "")
            if auth_header.startswith("Bearer "):
                # Use token hash as identifier to avoid storing tokens in Redis
                import hashlib
                identifier = hashlib.md5(auth_header.encode()).hexdigest()[:16]
            else:
                identifier = request.client.host if request.client else "unknown"

            # Find the most specific rate limit
            limit, window = DEFAULT_LIMIT
            for prefix, (lim, win) in RATE_LIMITS.items():
                if path.startswith(prefix):
                    limit, window = lim, win
                    break

            rate_key = f"{identifier}:{path}"
            allowed, remaining = await redis_service.check_rate_limit(
                rate_key, limit, window
            )

            if not allowed:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Rate limit exceeded. Try again later."},
                    headers={
                        "X-RateLimit-Limit": str(limit),
                        "X-RateLimit-Remaining": "0",
                        "Retry-After": str(window),
                    },
                )

            response = await call_next(request)
            response.headers["X-RateLimit-Limit"] = str(limit)
            response.headers["X-RateLimit-Remaining"] = str(remaining)
            return response

        except Exception:
            # If Redis is down, let requests through (fail-open)
            return await call_next(request)
