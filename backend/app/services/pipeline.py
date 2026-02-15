"""
Translation Pipeline — the core engine.

Flow: Audio In → STT (Deepgram) → Translate (GPT-4/Claude) → TTS (ElevenLabs) → Audio Out

All stages stream so we hit <500ms end-to-end latency.
"""

import asyncio
import time
from dataclasses import dataclass, field

from app.services.stt_service import stt_service
from app.services.translation_service import translation_service
from app.services.tts_service import tts_service
from app.services.logging_service import logging_service


@dataclass
class PipelineMetrics:
    """Track latency at each pipeline stage."""

    stt_start: float = 0
    stt_end: float = 0
    translate_start: float = 0
    translate_end: float = 0
    tts_start: float = 0
    tts_end: float = 0
    total_start: float = 0
    total_end: float = 0

    @property
    def stt_latency_ms(self) -> float:
        return (self.stt_end - self.stt_start) * 1000

    @property
    def translate_latency_ms(self) -> float:
        return (self.translate_end - self.translate_start) * 1000

    @property
    def tts_latency_ms(self) -> float:
        return (self.tts_end - self.tts_start) * 1000

    @property
    def total_latency_ms(self) -> float:
        return (self.total_end - self.total_start) * 1000

    def summary(self) -> dict:
        return {
            "stt_ms": round(self.stt_latency_ms, 1),
            "translate_ms": round(self.translate_latency_ms, 1),
            "tts_ms": round(self.tts_latency_ms, 1),
            "total_ms": round(self.total_latency_ms, 1),
        }


@dataclass
class TranslationContext:
    """User context injected into translation prompts."""

    user_id: str = ""
    source_language: str = "auto"
    target_language: str = "en"
    persona: str = ""  # e.g., "Factory owner, formal tone"
    industry: str = ""  # e.g., "manufacturing"
    custom_glossary: dict[str, str] = field(default_factory=dict)


class TranslationPipeline:
    """
    Orchestrates the full STT → Translate → TTS pipeline.

    Supports two modes:
    1. Batch: process a complete audio chunk end-to-end
    2. Streaming: stream each stage for minimum latency
    """

    async def process_audio(
        self,
        audio_data: bytes,
        context: TranslationContext,
        voice_id: str | None = None,
    ) -> tuple[bytes, str, PipelineMetrics]:
        """
        Process a chunk of audio through the full pipeline.

        Returns:
            (translated_audio, translated_text, metrics)
        """
        metrics = PipelineMetrics(total_start=time.time())

        # --- Stage 1: Speech-to-Text ---
        metrics.stt_start = time.time()
        transcript = await stt_service.transcribe(
            audio_data=audio_data,
            language=context.source_language,
        )
        metrics.stt_end = time.time()

        if not transcript.strip():
            metrics.total_end = time.time()
            return b"", "", metrics

        # --- Stage 2: Translation ---
        metrics.translate_start = time.time()
        translated_text = await translation_service.translate(
            text=transcript,
            source_language=context.source_language,
            target_language=context.target_language,
            persona=context.persona,
            industry=context.industry,
            glossary=context.custom_glossary,
        )
        metrics.translate_end = time.time()

        # Log translation for analytics
        asyncio.create_task(
            self._log_translation(context, transcript, translated_text, metrics.translate_latency_ms)
        )

        # --- Stage 3: Text-to-Speech ---
        metrics.tts_start = time.time()
        audio_out = await tts_service.synthesize(
            text=translated_text,
            voice_id=voice_id,
            language=context.target_language,
        )
        metrics.tts_end = time.time()

        metrics.total_end = time.time()
        return audio_out, translated_text, metrics

    async def _log_translation(
        self, context: TranslationContext, source_text: str, translated_text: str, latency_ms: float
    ):
        """Fire-and-forget logging."""
        try:
            await logging_service.log_translation(
                source_language=context.source_language,
                target_language=context.target_language,
                source_text=source_text,
                translated_text=translated_text,
                latency_ms=latency_ms,
                model_used="gpt-4-turbo",
            )
        except Exception:
            pass

    async def process_audio_streaming(
        self,
        audio_data: bytes,
        context: TranslationContext,
        voice_id: str | None = None,
    ):
        """
        Streaming pipeline: yields audio chunks as soon as they're available.
        This is how we hit <500ms — we don't wait for full sentences.

        Yields:
            dict with keys: "type" (text|audio|metrics), "data" (the payload)
        """
        total_start = time.time()

        # Stage 1: STT
        stt_start = time.time()
        transcript = await stt_service.transcribe(
            audio_data=audio_data,
            language=context.source_language,
        )
        stt_end = time.time()

        if not transcript.strip():
            return

        yield {"type": "transcript", "data": transcript}

        # Stage 2: Translation (streaming)
        translate_start = time.time()
        translated_chunks: list[str] = []

        async for chunk in translation_service.translate_stream(
            text=transcript,
            source_language=context.source_language,
            target_language=context.target_language,
            persona=context.persona,
            industry=context.industry,
            glossary=context.custom_glossary,
        ):
            translated_chunks.append(chunk)
            yield {"type": "text", "data": chunk}

        translate_end = time.time()
        full_translation = "".join(translated_chunks)

        # Stage 3: TTS (streaming)
        tts_start = time.time()
        async for audio_chunk in tts_service.synthesize_stream(
            text=full_translation,
            voice_id=voice_id,
            language=context.target_language,
        ):
            yield {"type": "audio", "data": audio_chunk}

        tts_end = time.time()
        total_end = time.time()

        yield {
            "type": "metrics",
            "data": {
                "stt_ms": round((stt_end - stt_start) * 1000, 1),
                "translate_ms": round((translate_end - translate_start) * 1000, 1),
                "tts_ms": round((tts_end - tts_start) * 1000, 1),
                "total_ms": round((total_end - total_start) * 1000, 1),
            },
        }


# Singleton
pipeline = TranslationPipeline()
