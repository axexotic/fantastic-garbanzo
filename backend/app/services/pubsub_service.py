"""Redis Pub/Sub for multi-instance WebSocket broadcasting.

When running multiple backend instances, WebSocket messages sent on one instance
need to reach clients connected to other instances. This module provides that
cross-instance broadcast layer via Redis Pub/Sub channels.

Usage:
    # On startup
    await pubsub_service.connect(redis_url)
    await pubsub_service.start_listener(on_message_callback)

    # To broadcast
    await pubsub_service.publish("chat:123", {"type": "new_message", ...})

    # On shutdown
    await pubsub_service.disconnect()
"""

import asyncio
import json
import logging
from typing import Callable, Awaitable

import redis.asyncio as redis

logger = logging.getLogger(__name__)


class PubSubService:
    """Redis-backed pub/sub for WebSocket cross-instance messaging."""

    def __init__(self):
        self._redis: redis.Redis | None = None
        self._pubsub: redis.client.PubSub | None = None
        self._listener_task: asyncio.Task | None = None
        self._subscriptions: dict[str, Callable[[dict], Awaitable[None]]] = {}

    async def connect(self, url: str) -> None:
        """Connect to Redis for pub/sub."""
        self._redis = redis.from_url(url, decode_responses=True)
        self._pubsub = self._redis.pubsub()
        logger.info("PubSub connected to Redis")

    async def disconnect(self) -> None:
        """Clean up connections."""
        if self._listener_task:
            self._listener_task.cancel()
            try:
                await self._listener_task
            except asyncio.CancelledError:
                pass
        if self._pubsub:
            await self._pubsub.unsubscribe()
            await self._pubsub.aclose()
        if self._redis:
            await self._redis.aclose()
        logger.info("PubSub disconnected")

    async def subscribe(
        self, channel: str, callback: Callable[[dict], Awaitable[None]]
    ) -> None:
        """Subscribe to a channel with a callback."""
        if not self._pubsub:
            return
        self._subscriptions[channel] = callback
        await self._pubsub.subscribe(channel)
        logger.debug(f"Subscribed to channel: {channel}")

    async def unsubscribe(self, channel: str) -> None:
        """Unsubscribe from a channel."""
        if not self._pubsub:
            return
        self._subscriptions.pop(channel, None)
        await self._pubsub.unsubscribe(channel)

    async def publish(self, channel: str, message: dict) -> None:
        """Publish a message to a channel."""
        if not self._redis:
            return
        try:
            await self._redis.publish(channel, json.dumps(message))
        except Exception as e:
            logger.error(f"PubSub publish error: {e}")

    async def start_listener(self) -> None:
        """Start the background listener for incoming pub/sub messages."""
        if not self._pubsub:
            return

        async def _listen():
            try:
                async for message in self._pubsub.listen():
                    if message["type"] != "message":
                        continue
                    channel = message["channel"]
                    callback = self._subscriptions.get(channel)
                    if callback:
                        try:
                            data = json.loads(message["data"])
                            await callback(data)
                        except Exception as e:
                            logger.error(f"PubSub callback error on {channel}: {e}")
            except asyncio.CancelledError:
                return
            except Exception as e:
                logger.error(f"PubSub listener error: {e}")

        self._listener_task = asyncio.create_task(_listen())
        logger.info("PubSub listener started")

    # ── Convenience channels ──

    async def broadcast_chat_message(self, chat_id: str, message: dict) -> None:
        """Broadcast a chat message across instances."""
        await self.publish(f"chat:{chat_id}", message)

    async def broadcast_presence(self, user_id: str, status: str) -> None:
        """Broadcast a presence update across instances."""
        await self.publish("presence", {"user_id": user_id, "status": status})

    async def broadcast_call_event(self, chat_id: str, event: dict) -> None:
        """Broadcast a call event across instances."""
        await self.publish(f"call:{chat_id}", event)


# Singleton
pubsub_service = PubSubService()
