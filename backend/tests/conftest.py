"""Shared test fixtures."""

import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest


@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for the entire test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def mock_redis():
    """Mock Redis service for unit tests."""
    mock = AsyncMock()
    mock.get.return_value = None
    mock.set.return_value = None
    mock.get_json.return_value = None
    mock.set_json.return_value = None
    mock.get_translation.return_value = None
    mock.set_translation.return_value = None
    mock.check_rate_limit.return_value = (True, 99)
    mock.increment_counter.return_value = 1
    return mock
