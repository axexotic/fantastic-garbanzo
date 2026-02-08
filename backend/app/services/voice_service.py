"""Voice cloning & profile management via ElevenLabs."""

import httpx

from app.config import get_settings
from app.services.redis_service import redis_service


class VoiceService:
    """Manage voice profiles — cloning, storage, retrieval."""

    BASE_URL = "https://api.elevenlabs.io/v1"

    async def clone_voice(
        self,
        user_id: str,
        audio_data: bytes,
        file_name: str = "sample.wav",
    ) -> str:
        """
        Clone a voice from an audio sample using ElevenLabs Professional Voice Cloning.

        Returns the ElevenLabs voice_id.
        """
        settings = get_settings()

        headers = {"xi-api-key": settings.elevenlabs_api_key}

        # ElevenLabs instant voice clone endpoint
        files = {"files": (file_name, audio_data, "audio/wav")}
        data = {
            "name": f"user_{user_id}_voice",
            "description": f"Cloned voice for user {user_id}",
        }

        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{self.BASE_URL}/voices/add",
                headers=headers,
                files=files,
                data=data,
            )
            resp.raise_for_status()
            result = resp.json()

        voice_id = result["voice_id"]

        # Cache voice profile in Redis
        await redis_service.set_json(
            f"voice_profile:{user_id}",
            {
                "user_id": user_id,
                "voice_id": voice_id,
                "status": "active",
            },
        )

        return voice_id

    async def get_profile(self, user_id: str) -> dict | None:
        """Get cached voice profile for a user."""
        return await redis_service.get_json(f"voice_profile:{user_id}")

    async def get_voice_id(self, user_id: str) -> str | None:
        """Get the ElevenLabs voice_id for a user."""
        profile = await self.get_profile(user_id)
        return profile.get("voice_id") if profile else None


# Singleton
voice_service = VoiceService()
