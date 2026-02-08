"""Translation service — GPT-4 Turbo (primary) + Claude 3.5 Sonnet (fallback)."""

from openai import AsyncOpenAI
from anthropic import AsyncAnthropic

from app.config import get_settings

# Supported languages with display names
SUPPORTED_LANGUAGES = {
    "en": "English",
    "th": "Thai",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "ja": "Japanese",
    "ko": "Korean",
    "zh": "Chinese (Mandarin)",
    "ar": "Arabic",
    "pt": "Portuguese",
    "ru": "Russian",
    "hi": "Hindi",
    "vi": "Vietnamese",
    "it": "Italian",
    "nl": "Dutch",
    "tr": "Turkish",
    "pl": "Polish",
    "sv": "Swedish",
    "id": "Indonesian",
    "ms": "Malay",
}


def _build_system_prompt(
    source_language: str,
    target_language: str,
    persona: str = "",
    industry: str = "",
    glossary: dict[str, str] | None = None,
) -> str:
    """Build context-aware system prompt for translation."""
    src_name = SUPPORTED_LANGUAGES.get(source_language, source_language)
    tgt_name = SUPPORTED_LANGUAGES.get(target_language, target_language)

    prompt = f"""You are a real-time voice translator. Translate spoken {src_name} to {tgt_name}.

RULES:
- Preserve the speaker's tone, emotion, and intent
- Keep it natural — this will be spoken aloud via TTS
- Do NOT add explanations, notes, or commentary
- Preserve idioms by finding equivalent expressions in the target language
- Keep proper nouns unchanged
- Output ONLY the translated text, nothing else"""

    if persona:
        prompt += f"\n\nSPEAKER CONTEXT: {persona}"

    if industry:
        prompt += f"\nINDUSTRY: {industry} — use appropriate terminology"

    if glossary:
        glossary_str = "\n".join(f"  {k} → {v}" for k, v in glossary.items())
        prompt += f"\n\nCUSTOM GLOSSARY:\n{glossary_str}"

    return prompt


class TranslationService:
    """Hybrid GPT-4 + Claude translation with automatic fallback."""

    async def translate(
        self,
        text: str,
        source_language: str = "auto",
        target_language: str = "en",
        persona: str = "",
        industry: str = "",
        glossary: dict[str, str] | None = None,
        use_claude: bool = False,
    ) -> str:
        """Translate text using GPT-4 Turbo (or Claude as fallback)."""
        system_prompt = _build_system_prompt(
            source_language, target_language, persona, industry, glossary
        )

        if use_claude:
            return await self._translate_claude(text, system_prompt)

        try:
            return await self._translate_openai(text, system_prompt)
        except Exception:
            # Fallback to Claude
            return await self._translate_claude(text, system_prompt)

    async def translate_stream(
        self,
        text: str,
        source_language: str = "auto",
        target_language: str = "en",
        persona: str = "",
        industry: str = "",
        glossary: dict[str, str] | None = None,
    ):
        """Stream translation tokens for lower latency."""
        settings = get_settings()
        system_prompt = _build_system_prompt(
            source_language, target_language, persona, industry, glossary
        )

        client = AsyncOpenAI(api_key=settings.openai_api_key)

        stream = await client.chat.completions.create(
            model="gpt-4-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text},
            ],
            stream=True,
            temperature=0.3,
            max_tokens=1024,
        )

        async for chunk in stream:
            delta = chunk.choices[0].delta
            if delta.content:
                yield delta.content

    async def _translate_openai(self, text: str, system_prompt: str) -> str:
        settings = get_settings()
        client = AsyncOpenAI(api_key=settings.openai_api_key)

        response = await client.chat.completions.create(
            model="gpt-4-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text},
            ],
            temperature=0.3,
            max_tokens=1024,
        )

        return response.choices[0].message.content or ""

    async def _translate_claude(self, text: str, system_prompt: str) -> str:
        settings = get_settings()
        client = AsyncAnthropic(api_key=settings.anthropic_api_key)

        response = await client.messages.create(
            model="claude-3-5-sonnet-20241022",
            system=system_prompt,
            messages=[{"role": "user", "content": text}],
            max_tokens=1024,
            temperature=0.3,
        )

        return response.content[0].text if response.content else ""


# Singleton
translation_service = TranslationService()
