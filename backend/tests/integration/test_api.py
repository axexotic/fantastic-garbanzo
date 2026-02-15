"""Integration tests for API endpoints using httpx AsyncClient."""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.models import User


@pytest.fixture
def mock_db():
    """Mock the database session."""
    return AsyncMock()


@pytest.fixture
def sample_user():
    return User(
        id=uuid4(),
        email="test@test.com",
        username="testuser",
        display_name="Test User",
        password_hash="$2b$12$hashed",
        preferred_language="en",
        status="online",
        bio="",
        avatar_url="",
        is_active=True,
    )


class TestHealthEndpoint:
    @pytest.mark.asyncio
    async def test_health_returns_ok(self):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/health")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "healthy"


class TestAuthEndpoints:
    @pytest.mark.asyncio
    @patch("app.routers.auth.get_db")
    async def test_signup_missing_fields(self, mock_get_db):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post("/api/auth/signup", json={})
            assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    @patch("app.routers.auth.get_db")
    async def test_login_missing_fields(self, mock_get_db):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post("/api/auth/login", json={})
            assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_me_without_token(self):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/auth/me")
            assert response.status_code == 403  # No bearer token


class TestProtectedEndpoints:
    """Verify that protected endpoints reject unauthorized requests."""

    @pytest.mark.asyncio
    async def test_friends_requires_auth(self):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/friends")
            assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_chats_requires_auth(self):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/chats")
            assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_calls_requires_auth(self):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/calls/active-calls")
            assert response.status_code == 403
