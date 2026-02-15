"""AI-powered analysis service — call summarization, sentiment, entities, action items."""

import json
import logging
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an AI assistant that analyzes conversation transcripts.
Always respond with valid JSON only — no markdown fences, no commentary."""


class AIService:
    """
    Uses OpenAI GPT-4 (primary) or Anthropic Claude (fallback)
    for call/chat analysis tasks.
    """

    def __init__(self):
        self._settings = get_settings()

    # ─── Public API ─────────────────────────────────────

    async def summarize(self, transcript: str, max_length: int = 300) -> dict:
        """Generate a concise summary of a transcript."""
        prompt = (
            f"Summarize the following conversation in {max_length} characters or fewer. "
            "Return JSON: {\"summary\": \"...\", \"key_topics\": [\"...\"], \"duration_context\": \"...\"}\n\n"
            f"Transcript:\n{transcript}"
        )
        raw = await self._call_llm(prompt)
        return self._parse_json(raw, fallback={"summary": raw, "key_topics": [], "duration_context": ""})

    async def sentiment(self, transcript: str) -> dict:
        """Analyze overall and per-speaker sentiment."""
        prompt = (
            "Analyze the sentiment of this conversation. "
            "Return JSON: {\"overall\": \"positive|neutral|negative|mixed\", "
            "\"score\": 0.0-1.0, \"speakers\": [{\"name\": \"...\", \"sentiment\": \"...\", \"score\": 0.0-1.0}], "
            "\"tone\": \"friendly|formal|tense|casual|...\"}\n\n"
            f"Transcript:\n{transcript}"
        )
        raw = await self._call_llm(prompt)
        return self._parse_json(raw, fallback={
            "overall": "neutral", "score": 0.5, "speakers": [], "tone": "neutral"
        })

    async def extract_entities(self, transcript: str) -> dict:
        """Extract named entities (people, places, orgs, dates, etc)."""
        prompt = (
            "Extract named entities from this conversation. "
            "Return JSON: {\"entities\": [{\"text\": \"...\", \"type\": \"PERSON|ORG|LOCATION|DATE|NUMBER|OTHER\", "
            "\"context\": \"brief context\"}]}\n\n"
            f"Transcript:\n{transcript}"
        )
        raw = await self._call_llm(prompt)
        return self._parse_json(raw, fallback={"entities": []})

    async def extract_action_items(self, transcript: str) -> dict:
        """Extract action items / tasks from the conversation."""
        prompt = (
            "Extract all action items, tasks, and follow-ups from this conversation. "
            "Return JSON: {\"action_items\": [{\"task\": \"...\", \"assignee\": \"...\" or null, "
            "\"deadline\": \"...\" or null, \"priority\": \"high|medium|low\"}]}\n\n"
            f"Transcript:\n{transcript}"
        )
        raw = await self._call_llm(prompt)
        return self._parse_json(raw, fallback={"action_items": []})

    async def full_analysis(self, transcript: str) -> dict:
        """Run all analyses in one shot for efficiency."""
        prompt = (
            "Analyze this conversation and return a comprehensive JSON report with these keys:\n"
            "1. \"summary\": concise summary (max 300 chars)\n"
            "2. \"key_topics\": list of main topics discussed\n"
            "3. \"sentiment\": {\"overall\": \"positive|neutral|negative|mixed\", \"score\": 0.0-1.0, \"tone\": \"...\"}\n"
            "4. \"entities\": [{\"text\": \"...\", \"type\": \"PERSON|ORG|LOCATION|DATE|NUMBER\", \"context\": \"...\"}]\n"
            "5. \"action_items\": [{\"task\": \"...\", \"assignee\": null, \"deadline\": null, \"priority\": \"high|medium|low\"}]\n\n"
            f"Transcript:\n{transcript}"
        )
        raw = await self._call_llm(prompt)
        return self._parse_json(raw, fallback={
            "summary": "", "key_topics": [], "sentiment": {"overall": "neutral", "score": 0.5},
            "entities": [], "action_items": [],
        })

    # ─── LLM Backends ──────────────────────────────────

    async def _call_llm(self, prompt: str) -> str:
        """Try OpenAI first, fallback to Anthropic."""
        if self._settings.openai_api_key:
            try:
                return await self._call_openai(prompt)
            except Exception as e:
                logger.warning("OpenAI failed, trying Anthropic: %s", e)

        if self._settings.anthropic_api_key:
            return await self._call_anthropic(prompt)

        raise RuntimeError("No AI provider configured (set OPENAI_API_KEY or ANTHROPIC_API_KEY)")

    async def _call_openai(self, prompt: str) -> str:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {self._settings.openai_api_key}"},
                json={
                    "model": "gpt-4-turbo-preview",
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.3,
                    "max_tokens": 2000,
                    "response_format": {"type": "json_object"},
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    async def _call_anthropic(self, prompt: str) -> str:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": self._settings.anthropic_api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "claude-3-5-sonnet-20241022",
                    "max_tokens": 2000,
                    "system": SYSTEM_PROMPT,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["content"][0]["text"]

    # ─── Helpers ────────────────────────────────────────

    @staticmethod
    def _parse_json(raw: str, fallback: dict) -> dict:
        """Safely parse JSON from LLM response."""
        try:
            # Strip markdown fences if present
            text = raw.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                if text.endswith("```"):
                    text = text[:-3]
            return json.loads(text)
        except (json.JSONDecodeError, IndexError):
            return fallback


# Singleton
ai_service = AIService()
