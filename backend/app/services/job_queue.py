"""
Async job queue — lightweight Redis-backed task queue using arq.

For heavy tasks: batch translations, voice cloning post-processing, email sends.
Falls back to asyncio.create_task() if arq is not installed.
"""

import asyncio
import logging
from typing import Any, Callable, Coroutine

from app.services.redis_service import redis_service

logger = logging.getLogger(__name__)


class JobQueue:
    """
    Lightweight async job queue backed by Redis lists.

    Jobs are serialized as JSON and pushed to a Redis list.
    The worker pops jobs and executes registered handlers.

    For production, consider upgrading to arq, celery, or similar.
    """

    def __init__(self):
        self._handlers: dict[str, Callable[..., Coroutine]] = {}
        self._queue_key = "job_queue:default"
        self._running = False

    def register(self, name: str):
        """Decorator to register a job handler."""
        def decorator(func: Callable[..., Coroutine]):
            self._handlers[name] = func
            return func
        return decorator

    async def enqueue(self, name: str, **kwargs: Any) -> bool:
        """
        Enqueue a job for background processing.

        Falls back to running inline if no worker is active.
        """
        import json

        try:
            job_data = json.dumps({"name": name, "kwargs": kwargs})
            await redis_service.client.rpush(self._queue_key, job_data)
            logger.debug("Enqueued job: %s", name)
            return True
        except Exception as e:
            logger.warning("Failed to enqueue job %s, running inline: %s", name, e)
            # Fallback: run inline
            handler = self._handlers.get(name)
            if handler:
                asyncio.create_task(handler(**kwargs))
            return False

    async def process_one(self) -> bool:
        """Pop and process a single job. Returns True if a job was processed."""
        import json

        try:
            raw = await redis_service.client.lpop(self._queue_key)
            if not raw:
                return False

            job = json.loads(raw)
            name = job["name"]
            kwargs = job.get("kwargs", {})

            handler = self._handlers.get(name)
            if not handler:
                logger.error("No handler for job: %s", name)
                return False

            logger.info("Processing job: %s", name)
            await handler(**kwargs)
            return True

        except Exception as e:
            logger.error("Job processing error: %s", e, exc_info=True)
            return False

    async def run_worker(self, poll_interval: float = 1.0):
        """Run the worker loop — polls Redis for jobs."""
        logger.info("Job queue worker started")
        self._running = True

        while self._running:
            processed = await self.process_one()
            if not processed:
                await asyncio.sleep(poll_interval)

    def stop(self):
        """Signal the worker to stop."""
        self._running = False

    async def queue_length(self) -> int:
        """Get number of pending jobs."""
        try:
            return await redis_service.client.llen(self._queue_key)
        except Exception:
            return 0


# Singleton
job_queue = JobQueue()


# ─── Register Built-in Jobs ────────────────────────────────

@job_queue.register("send_email")
async def _job_send_email(
    email_type: str, to_email: str, **kwargs
):
    """Background email sending."""
    from app.services.email_service import email_service

    handlers = {
        "welcome": email_service.send_welcome,
        "friend_request": email_service.send_friend_request,
        "missed_call": email_service.send_missed_call,
        "password_reset": email_service.send_password_reset,
    }

    handler = handlers.get(email_type)
    if handler:
        await handler(to_email=to_email, **kwargs)
    else:
        logger.warning("Unknown email type: %s", email_type)


@job_queue.register("log_translation")
async def _job_log_translation(**kwargs):
    """Background translation logging."""
    from app.services.logging_service import logging_service
    await logging_service.log_translation(**kwargs)


@job_queue.register("batch_translate")
async def _job_batch_translate(
    texts: list[str],
    source_language: str,
    target_language: str,
    chat_id: str | None = None,
):
    """Batch translate multiple texts (e.g., for backfill)."""
    from app.services.translation_service import translation_service

    results = []
    for text in texts:
        translated = await translation_service.translate(
            text=text,
            source_language=source_language,
            target_language=target_language,
        )
        results.append(translated)

    logger.info("Batch translated %d texts (%s → %s)", len(texts), source_language, target_language)
    return results
