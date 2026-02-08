"""Redis service — session state, caching, voice profiles."""

import json

import redis.asyncio as redis


class RedisService:
    """Async Redis client for session state and caching."""

    def __init__(self):
        self._client: redis.Redis | None = None

    async def connect(self, url: str) -> None:
        self._client = redis.from_url(url, decode_responses=True)
        await self._client.ping()

    async def disconnect(self) -> None:
        if self._client:
            await self._client.aclose()

    @property
    def client(self) -> redis.Redis:
        if not self._client:
            raise RuntimeError("Redis not connected. Call connect() first.")
        return self._client

    # -- Key/Value --

    async def get(self, key: str) -> str | None:
        return await self.client.get(key)

    async def set(
        self, key: str, value: str, expire_seconds: int | None = None
    ) -> None:
        if expire_seconds:
            await self.client.setex(key, expire_seconds, value)
        else:
            await self.client.set(key, value)

    async def delete(self, key: str) -> None:
        await self.client.delete(key)

    # -- JSON helpers --

    async def get_json(self, key: str) -> dict | None:
        raw = await self.get(key)
        return json.loads(raw) if raw else None

    async def set_json(
        self, key: str, data: dict, expire_seconds: int | None = None
    ) -> None:
        await self.set(key, json.dumps(data), expire_seconds)

    # -- Session helpers --

    async def get_session(self, session_id: str) -> dict | None:
        return await self.get_json(f"session:{session_id}")

    async def set_session(
        self, session_id: str, data: dict, expire_seconds: int = 3600
    ) -> None:
        await self.set_json(f"session:{session_id}", data, expire_seconds)


# Singleton
redis_service = RedisService()
