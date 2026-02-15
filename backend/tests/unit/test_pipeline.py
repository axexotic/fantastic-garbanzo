"""Unit tests for translation pipeline."""

from unittest.mock import AsyncMock, patch

import pytest

from app.services.pipeline import PipelineMetrics, TranslationContext, TranslationPipeline


class TestPipelineMetrics:
    def test_latency_calculation(self):
        m = PipelineMetrics(
            stt_start=0.0, stt_end=0.1,
            translate_start=0.1, translate_end=0.2,
            tts_start=0.2, tts_end=0.3,
            total_start=0.0, total_end=0.3,
        )
        assert abs(m.stt_latency_ms - 100.0) < 0.1
        assert abs(m.translate_latency_ms - 100.0) < 0.1
        assert abs(m.tts_latency_ms - 100.0) < 0.1
        assert abs(m.total_latency_ms - 300.0) < 0.1

    def test_summary(self):
        m = PipelineMetrics(
            stt_start=0.0, stt_end=0.05,
            translate_start=0.05, translate_end=0.15,
            tts_start=0.15, tts_end=0.25,
            total_start=0.0, total_end=0.25,
        )
        s = m.summary()
        assert "stt_ms" in s
        assert "translate_ms" in s
        assert "tts_ms" in s
        assert "total_ms" in s
        assert s["total_ms"] == 250.0


class TestTranslationContext:
    def test_defaults(self):
        ctx = TranslationContext()
        assert ctx.source_language == "auto"
        assert ctx.target_language == "en"
        assert ctx.persona == ""
        assert ctx.custom_glossary == {}

    def test_custom_values(self):
        ctx = TranslationContext(
            user_id="123",
            source_language="en",
            target_language="th",
            persona="Doctor, formal",
            industry="medical",
            custom_glossary={"BP": "blood pressure"},
        )
        assert ctx.target_language == "th"
        assert ctx.custom_glossary["BP"] == "blood pressure"


class TestTranslationPipeline:
    @pytest.mark.asyncio
    @patch("app.services.pipeline.tts_service")
    @patch("app.services.pipeline.translation_service")
    @patch("app.services.pipeline.stt_service")
    @patch("app.services.pipeline.logging_service")
    async def test_process_audio_full_flow(
        self, mock_logging, mock_stt, mock_translate, mock_tts
    ):
        mock_stt.transcribe = AsyncMock(return_value="hello")
        mock_translate.translate = AsyncMock(return_value="สวัสดี")
        mock_tts.synthesize = AsyncMock(return_value=b"audio_data")
        mock_logging.log_translation = AsyncMock()

        pipeline = TranslationPipeline()
        ctx = TranslationContext(source_language="en", target_language="th")

        audio, text, metrics = await pipeline.process_audio(b"raw_audio", ctx)

        assert text == "สวัสดี"
        assert audio == b"audio_data"
        assert metrics.total_latency_ms > 0
        mock_stt.transcribe.assert_called_once()
        mock_translate.translate.assert_called_once()
        mock_tts.synthesize.assert_called_once()

    @pytest.mark.asyncio
    @patch("app.services.pipeline.tts_service")
    @patch("app.services.pipeline.translation_service")
    @patch("app.services.pipeline.stt_service")
    @patch("app.services.pipeline.logging_service")
    async def test_empty_transcript_returns_empty(
        self, mock_logging, mock_stt, mock_translate, mock_tts
    ):
        mock_stt.transcribe = AsyncMock(return_value="  ")

        pipeline = TranslationPipeline()
        ctx = TranslationContext(source_language="en", target_language="th")

        audio, text, metrics = await pipeline.process_audio(b"silence", ctx)

        assert audio == b""
        assert text == ""
        mock_translate.translate.assert_not_called()
        mock_tts.synthesize.assert_not_called()
