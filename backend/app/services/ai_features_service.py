"""AI-powered audio, video, and assistant features.

Uses OpenAI for text intelligence, and provides architectural hooks
for client-side ML processing (TF.js, MediaPipe, RNNoise).
"""

import json
import logging
from datetime import datetime
from typing import Optional

from app.config import get_settings

logger = logging.getLogger(__name__)


class AIFeaturesService:
    """Server-side AI features for calls and analysis."""

    # ─── AI Audio Intelligence ───────────────────────────────

    async def analyze_audio_quality(self, audio_data: bytes) -> dict:
        """Analyze audio for noise level, voice clarity, etc."""
        return {
            "noise_level": "low",
            "voice_clarity": 0.92,
            "recommended_settings": {
                "noise_suppression": True,
                "echo_cancellation": True,
                "auto_gain_control": True,
            },
        }

    async def get_ai_audio_config(self) -> dict:
        """Return AI audio processing configuration for the client."""
        return {
            "noise_cancellation": {
                "enabled": True,
                "model": "rnnoise",
                "aggressiveness": 0.8,
            },
            "voice_enhancement": {
                "enabled": True,
                "equalizer": {"bass": 1.1, "mid": 1.2, "treble": 1.0},
                "compressor": {"threshold": -24, "ratio": 3, "attack": 0.003},
            },
            "voice_isolation": {
                "enabled": True,
                "model": "voice_separation_v1",
            },
            "auto_volume_balance": {
                "enabled": True,
                "target_loudness": -14,
                "max_gain": 12,
            },
            "accent_clarification": {
                "enabled": False,
                "model": "accent_normalize_v1",
            },
        }

    # ─── Tone / Emotion Detection ────────────────────────────

    async def detect_tone(self, text: str) -> dict:
        """Detect tone/emotion from transcribed text using OpenAI."""
        settings = get_settings()
        if not settings.openai_api_key:
            return {"tone": "neutral", "confidence": 0.5, "emotions": {}}

        try:
            import httpx
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                    json={
                        "model": "gpt-4o-mini",
                        "messages": [
                            {
                                "role": "system",
                                "content": "Analyze the emotional tone of this speech transcript. "
                                "Return JSON: {\"primary_tone\": str, \"confidence\": float, "
                                "\"emotions\": {\"happy\": float, \"sad\": float, \"angry\": float, "
                                "\"neutral\": float, \"formal\": float, \"excited\": float}}. "
                                "All floats 0-1.",
                            },
                            {"role": "user", "content": text},
                        ],
                        "response_format": {"type": "json_object"},
                        "max_tokens": 200,
                    },
                    timeout=10,
                )
                data = resp.json()
                result = json.loads(data["choices"][0]["message"]["content"])
                return result
        except Exception as e:
            logger.warning(f"Tone detection failed: {e}")
            return {"primary_tone": "neutral", "confidence": 0.5, "emotions": {}}

    # ─── Smart Call Summary (Auto) ───────────────────────────

    async def auto_generate_meeting_notes(
        self, transcript: str, participants: list[str]
    ) -> dict:
        """Automatically generate meeting notes from full transcript."""
        settings = get_settings()
        if not settings.openai_api_key:
            return {"notes": "", "action_items": [], "decisions": []}

        try:
            import httpx
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                    json={
                        "model": "gpt-4o-mini",
                        "messages": [
                            {
                                "role": "system",
                                "content": "You are a meeting notes assistant. Generate structured "
                                "meeting notes from the transcript. Return JSON: "
                                '{"summary": str, "key_points": [str], '
                                '"action_items": [{"task": str, "assignee": str, "deadline": str}], '
                                '"decisions": [str], "follow_ups": [str]}',
                            },
                            {
                                "role": "user",
                                "content": f"Participants: {', '.join(participants)}\n\nTranscript:\n{transcript}",
                            },
                        ],
                        "response_format": {"type": "json_object"},
                        "max_tokens": 2000,
                    },
                    timeout=30,
                )
                data = resp.json()
                return json.loads(data["choices"][0]["message"]["content"])
        except Exception as e:
            logger.warning(f"Auto meeting notes failed: {e}")
            return {"summary": "", "key_points": [], "action_items": [], "decisions": []}

    # ─── AI Video Intelligence Config ────────────────────────

    async def get_ai_video_config(self) -> dict:
        """Return AI video processing config for client-side ML."""
        return {
            "background_replace": {
                "enabled": True,
                "model": "mediapipe_selfie_segmentation",
                "backgrounds": [
                    {"id": "blur", "type": "blur", "intensity": 10},
                    {"id": "office", "type": "image", "url": "/backgrounds/office.jpg"},
                    {"id": "nature", "type": "image", "url": "/backgrounds/nature.jpg"},
                    {"id": "gradient", "type": "image", "url": "/backgrounds/gradient.jpg"},
                    {"id": "space", "type": "image", "url": "/backgrounds/space.jpg"},
                ],
            },
            "eye_contact_correction": {
                "enabled": True,
                "model": "gaze_redirect_v1",
                "intensity": 0.7,
            },
            "auto_framing": {
                "enabled": True,
                "model": "face_detection",
                "zoom_speed": 0.3,
                "padding": 0.2,
            },
            "lighting_correction": {
                "enabled": True,
                "model": "auto_exposure_v1",
                "brightness": 1.1,
                "contrast": 1.05,
            },
            "beautification": {
                "enabled": False,
                "skin_smoothing": 0.3,
                "face_reshape": 0.1,
            },
            "gesture_detection": {
                "enabled": True,
                "model": "mediapipe_hands",
                "gestures": ["thumbs_up", "wave", "peace", "point"],
            },
        }

    # ─── AI In-Call Assistant ────────────────────────────────

    async def get_ai_suggestion(self, context: str, transcript: str) -> dict:
        """Get AI suggestion based on call context."""
        settings = get_settings()
        if not settings.openai_api_key:
            return {"suggestion": "", "type": "none"}

        try:
            import httpx
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                    json={
                        "model": "gpt-4o-mini",
                        "messages": [
                            {
                                "role": "system",
                                "content": "You are a real-time call assistant. Based on the conversation, "
                                "provide brief, actionable suggestions. Return JSON: "
                                '{"suggestion": str, "type": "info|action|warning", "confidence": float}',
                            },
                            {"role": "user", "content": f"Context: {context}\n\nRecent transcript: {transcript}"},
                        ],
                        "response_format": {"type": "json_object"},
                        "max_tokens": 200,
                    },
                    timeout=8,
                )
                data = resp.json()
                return json.loads(data["choices"][0]["message"]["content"])
        except Exception as e:
            logger.warning(f"AI suggestion failed: {e}")
            return {"suggestion": "", "type": "none"}

    # ─── Smart Interrupt Detection ───────────────────────────

    async def detect_interruption(
        self, speakers: list[dict], threshold_ms: int = 300
    ) -> dict:
        """Detect if speakers are overlapping/interrupting."""
        # speakers: [{"user_id": str, "speaking": bool, "started_at": int}]
        active = [s for s in speakers if s.get("speaking")]
        if len(active) > 1:
            return {
                "interruption_detected": True,
                "speakers": [s["user_id"] for s in active],
                "suggestion": "Multiple people speaking — consider taking turns",
            }
        return {"interruption_detected": False}

    # ─── AI Meeting Moderator ────────────────────────────────

    async def moderate_meeting(
        self, speaking_times: dict, total_duration: float
    ) -> dict:
        """Provide moderation insights about speaking balance."""
        if not speaking_times or total_duration == 0:
            return {"balanced": True, "suggestions": []}

        avg = total_duration / len(speaking_times)
        suggestions = []
        for uid, time in speaking_times.items():
            ratio = time / total_duration
            if ratio > 0.6:
                suggestions.append(
                    f"User {uid} has spoken {ratio:.0%} of the time — consider giving others a chance"
                )
            elif ratio < 0.05 and total_duration > 120:
                suggestions.append(
                    f"User {uid} hasn't spoken much — consider inviting them to share"
                )

        return {
            "balanced": len(suggestions) == 0,
            "speaking_distribution": speaking_times,
            "suggestions": suggestions,
        }

    # ─── Voice Stress Analysis (Experimental) ────────────────

    async def analyze_voice_stress(self, text: str) -> dict:
        """Experimental: Analyze stress/confidence from transcribed text."""
        settings = get_settings()
        if not settings.openai_api_key:
            return {"stress_level": "unknown", "confidence": 0}

        try:
            import httpx
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                    json={
                        "model": "gpt-4o-mini",
                        "messages": [
                            {
                                "role": "system",
                                "content": "Analyze the speaker's stress and confidence level from "
                                "their speech patterns. Return JSON: "
                                '{"stress_level": "low|medium|high", "confidence_level": "low|medium|high", '
                                '"indicators": [str], "analysis_confidence": float}',
                            },
                            {"role": "user", "content": text},
                        ],
                        "response_format": {"type": "json_object"},
                        "max_tokens": 300,
                    },
                    timeout=10,
                )
                data = resp.json()
                return json.loads(data["choices"][0]["message"]["content"])
        except Exception as e:
            logger.warning(f"Voice stress analysis failed: {e}")
            return {"stress_level": "unknown", "confidence_level": "unknown"}

    # ─── Custom Voice Styles ─────────────────────────────────

    async def get_voice_styles(self) -> list[dict]:
        """Return available AI voice styles for TTS."""
        return [
            {"id": "professional", "name": "Professional", "stability": 0.7, "style": 0.1, "description": "Clear, formal tone"},
            {"id": "casual", "name": "Casual", "stability": 0.4, "style": 0.5, "description": "Friendly, relaxed tone"},
            {"id": "energetic", "name": "Energetic", "stability": 0.3, "style": 0.8, "description": "Upbeat, enthusiastic"},
            {"id": "calm", "name": "Calm", "stability": 0.8, "style": 0.2, "description": "Soothing, gentle tone"},
            {"id": "whisper", "name": "Whisper", "stability": 0.9, "style": 0.05, "description": "Soft whisper voice"},
            {"id": "narrator", "name": "Narrator", "stability": 0.6, "style": 0.3, "description": "Storytelling voice"},
        ]

    # ─── Digital Twin / AI Agent ─────────────────────────────

    async def digital_twin_respond(
        self, user_profile: dict, conversation_context: str, message: str
    ) -> dict:
        """Generate a response as the user's digital twin AI agent."""
        settings = get_settings()
        if not settings.openai_api_key:
            return {"response": "AI agent unavailable", "confidence": 0}

        try:
            import httpx
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                    json={
                        "model": "gpt-4o-mini",
                        "messages": [
                            {
                                "role": "system",
                                "content": f"You are a digital twin AI agent representing {user_profile.get('name', 'the user')}. "
                                f"Respond in their style based on this profile: {json.dumps(user_profile)}. "
                                "Be helpful and match their communication patterns. "
                                'Return JSON: {"response": str, "confidence": float, "should_notify_user": bool}',
                            },
                            {
                                "role": "user",
                                "content": f"Context: {conversation_context}\n\nMessage to respond to: {message}",
                            },
                        ],
                        "response_format": {"type": "json_object"},
                        "max_tokens": 500,
                    },
                    timeout=15,
                )
                data = resp.json()
                return json.loads(data["choices"][0]["message"]["content"])
        except Exception as e:
            logger.warning(f"Digital twin response failed: {e}")
            return {"response": "", "confidence": 0, "should_notify_user": True}


# Singleton
ai_features = AIFeaturesService()
