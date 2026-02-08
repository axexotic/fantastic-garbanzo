"""
WebSocket endpoint for real-time audio translation.

This is the main real-time channel:
- Client sends raw audio chunks over WebSocket
- Server processes through STT → Translate → TTS pipeline
- Server streams translated audio back

Protocol (JSON messages):
  Client → Server:
    { "type": "audio", "data": "<base64 audio>" }
    { "type": "config", "source_lang": "th", "target_lang": "en", "voice_id": "..." }

  Server → Client:
    { "type": "transcript", "data": "สวัสดี" }
    { "type": "translation", "data": "Hello" }
    { "type": "audio", "data": "<base64 audio chunk>" }
    { "type": "metrics", "data": { "stt_ms": 95, "translate_ms": 142, ... } }
    { "type": "error", "data": "error message" }
"""

import base64
import json
import traceback

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.pipeline import TranslationContext, pipeline
from app.services.redis_service import redis_service

router = APIRouter()


class CallSession:
    """Manages state for a single WebSocket translation session."""

    def __init__(self, websocket: WebSocket, session_id: str):
        self.ws = websocket
        self.session_id = session_id
        self.context = TranslationContext()
        self.voice_id: str | None = None
        self.is_active = True

    async def update_config(self, config: dict) -> None:
        """Update session config from client message."""
        if "source_lang" in config:
            self.context.source_language = config["source_lang"]
        if "target_lang" in config:
            self.context.target_language = config["target_lang"]
        if "voice_id" in config:
            self.voice_id = config["voice_id"]
        if "persona" in config:
            self.context.persona = config["persona"]
        if "industry" in config:
            self.context.industry = config["industry"]
        if "user_id" in config:
            self.context.user_id = config["user_id"]

        # Persist session state to Redis
        await redis_service.set_json(
            f"session:{self.session_id}",
            {
                "source_lang": self.context.source_language,
                "target_lang": self.context.target_language,
                "voice_id": self.voice_id,
                "persona": self.context.persona,
            },
            expire_seconds=3600,
        )

    async def send(self, msg_type: str, data) -> None:
        """Send a JSON message to the client."""
        if self.is_active:
            await self.ws.send_json({"type": msg_type, "data": data})


@router.websocket("/ws/translate/{session_id}")
async def websocket_translate(websocket: WebSocket, session_id: str):
    """
    Main WebSocket endpoint for real-time translation.

    Each connected client gets a CallSession that processes audio
    through the full pipeline and streams results back.
    """
    await websocket.accept()
    session = CallSession(websocket, session_id)

    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)

            msg_type = msg.get("type", "")

            if msg_type == "config":
                await session.update_config(msg)
                await session.send("config_ack", {"status": "ok"})

            elif msg_type == "audio":
                # Decode base64 audio from client
                audio_data = base64.b64decode(msg["data"])

                # Run streaming pipeline
                async for result in pipeline.process_audio_streaming(
                    audio_data=audio_data,
                    context=session.context,
                    voice_id=session.voice_id,
                ):
                    if result["type"] == "audio":
                        # Encode audio back to base64 for WebSocket
                        await session.send(
                            "audio",
                            base64.b64encode(result["data"]).decode(),
                        )
                    elif result["type"] == "transcript":
                        await session.send("transcript", result["data"])
                    elif result["type"] == "text":
                        await session.send("translation", result["data"])
                    elif result["type"] == "metrics":
                        await session.send("metrics", result["data"])

            elif msg_type == "ping":
                await session.send("pong", None)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        traceback.print_exc()
        try:
            await session.send("error", str(e))
        except Exception:
            pass
    finally:
        session.is_active = False
        # Clean up session from Redis
        await redis_service.delete(f"session:{session_id}")
