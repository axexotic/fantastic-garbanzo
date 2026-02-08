"""ElevenLabs TTS — Text-to-Speech with voice cloning."""

import httpx

from app.config import get_settings


class TTSService:
    """ElevenLabs Turbo v2.5 text-to-speech service."""

    BASE_URL = "https://api.elevenlabs.io/v1"
    DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # Rachel — fallback voice

    async def synthesize(
        self,
        text: str,
        voice_id: str | None = None,
        language: str = "en",
        model: str = "eleven_turbo_v2_5",
    ) -> bytes:
        """
        Convert text to speech audio bytes.

        Args:
            text: Text to speak
            voice_id: ElevenLabs voice ID (cloned or preset)
            language: Target language code
            model: ElevenLabs model (turbo for lowest latency)

        Returns:
            Audio bytes (MP3)
        """
        settings = get_settings()
        vid = voice_id or self.DEFAULT_VOICE_ID

        headers = {
            "xi-api-key": settings.elevenlabs_api_key,
            "Content-Type": "application/json",
        }

        payload = {
            "text": text,
            "model_id": model,
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.8,
                "style": 0.3,
                "use_speaker_boost": True,
            },
        }

        # Add language hint for multilingual model
        if language != "en":
            payload["language_code"] = language

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{self.BASE_URL}/text-to-speech/{vid}",
                headers=headers,
                json=payload,
            )
            resp.raise_for_status()
            return resp.content

    async def synthesize_stream(
        self,
        text: str,
        voice_id: str | None = None,
        language: str = "en",
        model: str = "eleven_turbo_v2_5",
    ):
        """
        Stream TTS audio chunks for minimum latency.
        Yields audio bytes as they arrive from ElevenLabs.
        """
        settings = get_settings()
        vid = voice_id or self.DEFAULT_VOICE_ID

        headers = {
            "xi-api-key": settings.elevenlabs_api_key,
            "Content-Type": "application/json",
        }

        payload = {
            "text": text,
            "model_id": model,
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.8,
                "style": 0.3,
                "use_speaker_boost": True,
            },
        }

        if language != "en":
            payload["language_code"] = language

        async with httpx.AsyncClient(timeout=30) as client:
            async with client.stream(
                "POST",
                f"{self.BASE_URL}/text-to-speech/{vid}/stream",
                headers=headers,
                json=payload,
            ) as resp:
                resp.raise_for_status()
                async for chunk in resp.aiter_bytes(chunk_size=4096):
                    yield chunk


# Singleton
tts_service = TTSService()
