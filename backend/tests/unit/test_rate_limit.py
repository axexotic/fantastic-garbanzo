"""Unit tests for rate limiting middleware."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from starlette.testclient import TestClient

from app.middleware.rate_limit import RATE_LIMITS, DEFAULT_LIMIT, RateLimitMiddleware


class TestRateLimitConfig:
    def test_default_limit_is_reasonable(self):
        limit, window = DEFAULT_LIMIT
        assert limit == 200
        assert window == 60

    def test_signup_rate_is_strict(self):
        limit, window = RATE_LIMITS["/api/auth/signup"]
        assert limit <= 10
        assert window >= 3600

    def test_voice_clone_rate_is_strict(self):
        limit, window = RATE_LIMITS["/api/voice/clone"]
        assert limit <= 10
        assert window >= 3600

    def test_all_endpoints_have_positive_limits(self):
        for path, (limit, window) in RATE_LIMITS.items():
            assert limit > 0, f"{path} has non-positive limit"
            assert window > 0, f"{path} has non-positive window"


class TestRateLimitMiddleware:
    @pytest.mark.asyncio
    async def test_health_endpoint_skipped(self):
        """Health check should bypass rate limiting."""
        middleware = RateLimitMiddleware(app=AsyncMock())

        request = MagicMock()
        request.url.path = "/health"
        call_next = AsyncMock(return_value=MagicMock())

        await middleware.dispatch(request, call_next)
        call_next.assert_called_once()

    @pytest.mark.asyncio
    async def test_non_api_endpoint_skipped(self):
        """Non-API paths should bypass rate limiting."""
        middleware = RateLimitMiddleware(app=AsyncMock())

        request = MagicMock()
        request.url.path = "/docs"
        call_next = AsyncMock(return_value=MagicMock())

        await middleware.dispatch(request, call_next)
        call_next.assert_called_once()
