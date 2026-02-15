"""Health check and metrics endpoints."""

import platform
import time
from datetime import datetime

from fastapi import APIRouter, Depends

from app.dependencies import get_current_user
from app.models.models import User

router = APIRouter(tags=["health"])

_start_time = time.time()


@router.get("/health")
async def health_check():
    """Basic health check — always lightweight."""
    return {"status": "healthy", "service": "voicetranslate", "timestamp": datetime.utcnow().isoformat()}


@router.get("/health/detailed")
async def detailed_health():
    """Detailed health: checks Redis and database connectivity."""
    checks = {"redis": "unknown", "database": "unknown"}

    # Check Redis
    try:
        from app.services.redis_service import redis_service
        await redis_service.client.ping()
        checks["redis"] = "healthy"
    except Exception as e:
        checks["redis"] = f"unhealthy: {e}"

    # Check Database
    try:
        from app.models.database import async_session
        from sqlalchemy import text
        async with async_session() as db:
            await db.execute(text("SELECT 1"))
        checks["database"] = "healthy"
    except Exception as e:
        checks["database"] = f"unhealthy: {e}"

    overall = "healthy" if all(v == "healthy" for v in checks.values()) else "degraded"
    return {
        "status": overall,
        "checks": checks,
        "uptime_seconds": round(time.time() - _start_time),
        "python_version": platform.python_version(),
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/health/metrics")
async def metrics():
    """Application metrics — translation stats, cache hits, uptime."""
    from app.services.redis_service import redis_service

    try:
        cache_hits = await redis_service.get_counter("translation_cache_hit")
        cache_misses = await redis_service.get_counter("translation_cache_miss")
        total_translations = cache_hits + cache_misses
        hit_rate = round(cache_hits / total_translations * 100, 1) if total_translations > 0 else 0.0
    except Exception:
        cache_hits = cache_misses = total_translations = 0
        hit_rate = 0.0

    return {
        "uptime_seconds": round(time.time() - _start_time),
        "translations": {
            "total": total_translations,
            "cache_hits": cache_hits,
            "cache_misses": cache_misses,
            "cache_hit_rate_pct": hit_rate,
        },
        "timestamp": datetime.utcnow().isoformat(),
    }
