"""Unit tests for Redis service."""

from unittest.mock import AsyncMock, patch

import pytest

from app.services.redis_service import RedisService


class TestTranslationCacheKey:
    def test_same_inputs_same_key(self):
        svc = RedisService()
        k1 = svc._translation_key("en", "fr", "hello")
        k2 = svc._translation_key("en", "fr", "hello")
        assert k1 == k2

    def test_different_text_different_key(self):
        svc = RedisService()
        k1 = svc._translation_key("en", "fr", "hello")
        k2 = svc._translation_key("en", "fr", "goodbye")
        assert k1 != k2

    def test_different_lang_pair_different_key(self):
        svc = RedisService()
        k1 = svc._translation_key("en", "fr", "hello")
        k2 = svc._translation_key("en", "de", "hello")
        assert k1 != k2

    def test_case_insensitive(self):
        svc = RedisService()
        k1 = svc._translation_key("en", "fr", "Hello")
        k2 = svc._translation_key("en", "fr", "hello")
        assert k1 == k2

    def test_strips_whitespace(self):
        svc = RedisService()
        k1 = svc._translation_key("en", "fr", "  hello  ")
        k2 = svc._translation_key("en", "fr", "hello")
        assert k1 == k2


class TestRateLimit:
    @pytest.mark.asyncio
    async def test_rate_limit_first_request_allowed(self):
        svc = RedisService()
        mock_client = AsyncMock()
        mock_client.get.return_value = None
        mock_client.setex.return_value = True
        svc._client = mock_client

        allowed, remaining = await svc.check_rate_limit("test", 10, 60)
        assert allowed is True
        assert remaining == 9

    @pytest.mark.asyncio
    async def test_rate_limit_exceeded(self):
        svc = RedisService()
        mock_client = AsyncMock()
        mock_client.get.return_value = "10"  # Already at limit
        svc._client = mock_client

        allowed, remaining = await svc.check_rate_limit("test", 10, 60)
        assert allowed is False
        assert remaining == 0
