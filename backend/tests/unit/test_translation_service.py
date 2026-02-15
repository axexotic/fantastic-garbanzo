"""Unit tests for translation service."""

from unittest.mock import AsyncMock, patch

import pytest

from app.services.translation_service import (
    SUPPORTED_LANGUAGES,
    TranslationService,
    _build_system_prompt,
)


class TestSupportedLanguages:
    def test_english_in_supported(self):
        assert "en" in SUPPORTED_LANGUAGES

    def test_thai_in_supported(self):
        assert "th" in SUPPORTED_LANGUAGES

    def test_minimum_language_count(self):
        assert len(SUPPORTED_LANGUAGES) >= 16


class TestBuildSystemPrompt:
    def test_basic_prompt(self):
        prompt = _build_system_prompt("en", "th")
        assert "English" in prompt
        assert "Thai" in prompt
        assert "ONLY the translated text" in prompt

    def test_prompt_with_persona(self):
        prompt = _build_system_prompt("en", "th", persona="Business executive")
        assert "Business executive" in prompt

    def test_prompt_with_industry(self):
        prompt = _build_system_prompt("en", "th", industry="healthcare")
        assert "healthcare" in prompt

    def test_prompt_with_glossary(self):
        glossary = {"hello": "สวัสดี"}
        prompt = _build_system_prompt("en", "th", glossary=glossary)
        assert "hello" in prompt
        assert "สวัสดี" in prompt


class TestTranslationService:
    @pytest.mark.asyncio
    async def test_same_language_returns_original(self):
        service = TranslationService()
        result = await service.translate("Hello", source_language="en", target_language="en")
        assert result == "Hello"

    @pytest.mark.asyncio
    async def test_translate_calls_openai_by_default(self):
        service = TranslationService()
        with patch.object(service, "_translate_openai", new_callable=AsyncMock) as mock_openai:
            mock_openai.return_value = "Bonjour"
            # Patch redis to avoid cache
            with patch("app.services.translation_service.redis_service") as mock_redis:
                mock_redis.get_translation = AsyncMock(return_value=None)
                mock_redis.set_translation = AsyncMock()
                mock_redis.increment_counter = AsyncMock()

                result = await service.translate("Hello", source_language="en", target_language="fr")

            assert result == "Bonjour"
            mock_openai.assert_called_once()

    @pytest.mark.asyncio
    async def test_translate_falls_back_to_claude(self):
        service = TranslationService()
        with patch.object(service, "_translate_openai", new_callable=AsyncMock) as mock_openai:
            mock_openai.side_effect = Exception("OpenAI down")
            with patch.object(service, "_translate_claude", new_callable=AsyncMock) as mock_claude:
                mock_claude.return_value = "Bonjour"
                with patch("app.services.translation_service.redis_service") as mock_redis:
                    mock_redis.get_translation = AsyncMock(return_value=None)
                    mock_redis.set_translation = AsyncMock()
                    mock_redis.increment_counter = AsyncMock()

                    result = await service.translate(
                        "Hello", source_language="en", target_language="fr"
                    )

                assert result == "Bonjour"
                mock_claude.assert_called_once()
