"""Application configuration via environment variables."""

from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    app_name: str = "VoiceTranslate"
    debug: bool = False
    secret_key: str = "change-me"
    backend_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:3000"

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/voicetranslate"
    redis_url: str = "redis://localhost:6379/0"

    # Deepgram (STT)
    deepgram_api_key: str = ""

    # ElevenLabs (TTS + Voice Cloning)
    elevenlabs_api_key: str = ""

    # OpenAI (Translation — primary)
    openai_api_key: str = ""

    # Anthropic (Translation — fallback)
    anthropic_api_key: str = ""

    # Daily.co (WebRTC) — DEPRECATED, kept for reference
    daily_api_key: str = ""
    daily_api_url: str = "https://api.daily.co/v1"

    # LiveKit (WebRTC)
    livekit_url: str = "wss://localhost:7880"
    livekit_public_url: str = ""  # Public URL for clients (falls back to livekit_url)
    livekit_api_key: str = ""
    livekit_api_secret: str = ""

    # AWS S3 (Voice storage)
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_s3_bucket: str = "voicetranslate-voices"
    aws_region: str = "us-east-1"

    # Monitoring
    sentry_dsn: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
