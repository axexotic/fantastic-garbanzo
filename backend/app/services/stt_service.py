"""Deepgram STT — Speech-to-Text with streaming support."""

import httpx

from app.config import get_settings


class STTService:
    """Deepgram Nova-2 speech-to-text service."""

    BASE_URL = "https://api.deepgram.com/v1"

    async def transcribe(
        self,
        audio_data: bytes,
        language: str = "auto",
        model: str = "nova-2",
    ) -> str:
        """
        Transcribe audio bytes → text.

        Args:
            audio_data: Raw audio bytes (WAV, MP3, etc.)
            language: BCP-47 language code or "auto" for detection
            model: Deepgram model (nova-2 recommended)

        Returns:
            Transcribed text string
        """
        settings = get_settings()

        params = {
            "model": model,
            "smart_format": "true",
            "punctuate": "true",
            "diarize": "true",
        }
        if language != "auto":
            params["language"] = language
        else:
            params["detect_language"] = "true"

        headers = {
            "Authorization": f"Token {settings.deepgram_api_key}",
            "Content-Type": "audio/wav",
        }

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{self.BASE_URL}/listen",
                params=params,
                headers=headers,
                content=audio_data,
            )
            resp.raise_for_status()
            data = resp.json()

        # Extract transcript from Deepgram response
        channels = data.get("results", {}).get("channels", [])
        if not channels:
            return ""

        alternatives = channels[0].get("alternatives", [])
        if not alternatives:
            return ""

        return alternatives[0].get("transcript", "")

    async def transcribe_stream(self, audio_data: bytes, language: str = "auto"):
        """
        Stream audio to Deepgram WebSocket for real-time transcription.
        This is used for live call audio — lower latency than batch.

        Yields partial transcripts as they arrive.
        """
        # For MVP, we use the batch endpoint above.
        # Production: use Deepgram's WebSocket streaming API
        # wss://api.deepgram.com/v1/listen
        transcript = await self.transcribe(audio_data, language)
        if transcript:
            yield transcript


# Singleton
stt_service = STTService()
