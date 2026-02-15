"""Translation & API call logging — populate TranslationLog table."""

import time
from datetime import datetime

from app.models.database import async_session
from app.models.models import TranslationLog


class LoggingService:
    """Log translations for analytics, debugging, and cost tracking."""

    async def log_translation(
        self,
        source_language: str,
        target_language: str,
        source_text: str,
        translated_text: str,
        latency_ms: float,
        model_used: str = "gpt-4-turbo",
        message_id: str | None = None,
        call_id: str | None = None,
    ) -> None:
        """Write a translation log entry to the database."""
        try:
            async with async_session() as db:
                log = TranslationLog(
                    message_id=message_id,
                    call_id=call_id,
                    source_language=source_language,
                    target_language=target_language,
                    source_text=source_text,
                    translated_text=translated_text,
                    latency_ms=latency_ms,
                    model_used=model_used,
                    created_at=datetime.utcnow(),
                )
                db.add(log)
                await db.commit()
        except Exception:
            pass  # Don't let logging break the main flow


# Singleton
logging_service = LoggingService()
