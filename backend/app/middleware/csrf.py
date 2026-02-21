"""CSRF protection middleware — double-submit cookie pattern.

For state-changing requests (POST, PUT, PATCH, DELETE) that use cookie-based auth,
the client must send a matching X-CSRF-Token header. The CSRF token is set as a
non-httponly cookie so JavaScript can read and send it back in headers.
"""

import secrets

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.config import get_settings

# Safe methods that don't need CSRF protection
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}

# Paths exempt from CSRF (e.g. webhook callbacks, auth endpoints that run
# before a CSRF cookie can exist)
CSRF_EXEMPT_PATHS = {
    "/api/auth/login",
    "/api/auth/signup",
    "/api/auth/refresh",
    "/api/payments/webhook",
    "/health",
    "/health/detailed",
    "/health/metrics",
    "/docs",
    "/openapi.json",
    "/redoc",
}


class CSRFMiddleware(BaseHTTPMiddleware):
    """Double-submit cookie CSRF protection."""

    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip non-API routes and exempt paths
        path = request.url.path
        if not path.startswith("/api") or path in CSRF_EXEMPT_PATHS:
            response = await call_next(request)
            # Still ensure CSRF cookie on exempt GET responses so it's
            # available immediately (e.g. after login/signup).
            if request.method in SAFE_METHODS:
                self._ensure_csrf_cookie(request, response)
            return response

        # Skip safe methods
        if request.method in SAFE_METHODS:
            response = await call_next(request)
            # Ensure CSRF cookie exists on every response
            self._ensure_csrf_cookie(request, response)
            return response

        # For state-changing methods: only enforce if using cookie auth
        # (Bearer token auth is already CSRF-safe since it's not auto-sent)
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            # Token in header = not vulnerable to CSRF
            return await call_next(request)

        # Cookie auth — validate CSRF token
        csrf_cookie = request.cookies.get("csrf_token")
        csrf_header = request.headers.get("x-csrf-token", "")

        if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
            return JSONResponse(
                status_code=403,
                content={"detail": "CSRF token missing or invalid"},
            )

        response = await call_next(request)
        return response

    @staticmethod
    def _ensure_csrf_cookie(request: Request, response: Response) -> None:
        """Set a CSRF cookie if one doesn't exist yet."""
        if "csrf_token" not in request.cookies:
            settings = get_settings()
            token = secrets.token_hex(32)
            kwargs: dict = dict(
                key="csrf_token",
                value=token,
                httponly=False,  # JS must be able to read this
                secure=not settings.debug,
                samesite="lax",
                max_age=7 * 24 * 60 * 60,
                path="/",
            )
            # In production, set domain so frontend JS on a different
            # subdomain (e.g. flaskai.xyz) can read the cookie set by
            # api.flaskai.xyz.
            if settings.cookie_domain:
                kwargs["domain"] = settings.cookie_domain
            response.set_cookie(**kwargs)
