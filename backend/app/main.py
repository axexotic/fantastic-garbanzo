"""FastAPI application factory."""

import logging
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

from app.config import get_settings
from app.routers import admin, ai, analytics, auth, call_features, calls, chats, friends, health, integrations, notifications, payments, recording, rooms, security, video_features, voice, websocket, whiteboard
from app.middleware.rate_limit import RateLimitMiddleware

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    settings = get_settings()

    # -- Initialize Sentry --
    if settings.sentry_dsn:
        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            traces_sample_rate=0.2,
            profiles_sample_rate=0.1,
            integrations=[FastApiIntegration(), SqlalchemyIntegration()],
            environment="production" if not settings.debug else "development",
        )
        logger.info("Sentry initialized")

    # -- Startup --
    from app.services.redis_service import redis_service

    await redis_service.connect(settings.redis_url)
    print(f"🚀 {settings.app_name} backend started")
    yield
    # -- Shutdown --
    await redis_service.disconnect()
    print("🛑 Backend shut down")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        description="Real-Time Voice Translation Chat Platform",
        version="0.2.0",
        lifespan=lifespan,
    )

    # CORS
    origins = [
        settings.frontend_url,
        "http://localhost:3000",
        "https://flaskai.xyz",
        "https://www.flaskai.xyz",
    ]
    # Deduplicate
    origins = list(dict.fromkeys(origins))
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Rate limiting
    app.add_middleware(RateLimitMiddleware)

    # Routers
    app.include_router(health.router)
    app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
    app.include_router(friends.router, prefix="/api/friends", tags=["friends"])
    app.include_router(chats.router, prefix="/api/chats", tags=["chats"])
    app.include_router(rooms.router, prefix="/api/rooms", tags=["rooms"])
    app.include_router(calls.router, prefix="/api/calls", tags=["calls"])
    app.include_router(call_features.router, prefix="/api/calls/features", tags=["call-features"])
    app.include_router(video_features.router, prefix="/api/video", tags=["video"])
    app.include_router(recording.router, prefix="/api/recording", tags=["recording"])
    app.include_router(whiteboard.router, prefix="/api/whiteboard", tags=["whiteboard"])
    app.include_router(voice.router, prefix="/api/voice", tags=["voice"])
    app.include_router(security.router, prefix="/api/security", tags=["security"])
    app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
    app.include_router(payments.router, prefix="/api/payments", tags=["payments"])
    app.include_router(ai.router, prefix="/api/ai", tags=["ai"])
    app.include_router(integrations.router, prefix="/api/integrations", tags=["integrations"])
    app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])
    app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
    app.include_router(websocket.router)

    return app


app = create_app()
