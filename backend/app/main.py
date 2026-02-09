"""FastAPI application factory."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import auth, calls, chats, friends, health, rooms, voice, websocket


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    settings = get_settings()
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
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_url, "http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routers
    app.include_router(health.router)
    app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
    app.include_router(friends.router, prefix="/api/friends", tags=["friends"])
    app.include_router(chats.router, prefix="/api/chats", tags=["chats"])
    app.include_router(rooms.router, prefix="/api/rooms", tags=["rooms"])
    app.include_router(calls.router, prefix="/api/calls", tags=["calls"])
    app.include_router(voice.router, prefix="/api/voice", tags=["voice"])
    app.include_router(websocket.router)

    return app


app = create_app()
