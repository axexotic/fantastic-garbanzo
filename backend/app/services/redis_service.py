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

    # -- Translation cache --

    def _translation_key(self, source_lang: str, target_lang: str, text: str) -> str:
        """Generate a cache key for translations using a hash of the text."""
        import hashlib
        text_hash = hashlib.md5(text.strip().lower().encode()).hexdigest()
        return f"trans:{source_lang}:{target_lang}:{text_hash}"

    async def get_translation(
        self, text: str, source_lang: str, target_lang: str
    ) -> str | None:
        """Get cached translation if available."""
        key = self._translation_key(source_lang, target_lang, text)
        return await self.get(key)

    async def set_translation(
        self,
        text: str,
        source_lang: str,
        target_lang: str,
        translated: str,
        expire_seconds: int = 86400,  # 24 hours
    ) -> None:
        """Cache a translation result."""
        key = self._translation_key(source_lang, target_lang, text)
        await self.set(key, translated, expire_seconds)

    # -- Rate limiting --

    async def check_rate_limit(
        self, identifier: str, limit: int, window_seconds: int = 60
    ) -> tuple[bool, int]:
        """
        Check if rate limit is exceeded.

        Returns:
            (allowed: bool, remaining: int)
        """
        key = f"ratelimit:{identifier}"
        current = await self.client.get(key)
        if current is None:
            await self.client.setex(key, window_seconds, 1)
            return True, limit - 1
        count = int(current)
        if count >= limit:
            return False, 0
        await self.client.incr(key)
        return True, limit - count - 1

    # -- Metrics counters --

    async def increment_counter(self, key: str) -> int:
        """Increment a counter and return new value."""
        return await self.client.incr(f"metric:{key}")

    async def get_counter(self, key: str) -> int:
        val = await self.client.get(f"metric:{key}")
        return int(val) if val else 0


# Singleton
redis_service = RedisService()
