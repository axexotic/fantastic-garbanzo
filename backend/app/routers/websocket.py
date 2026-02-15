"""
WebSocket endpoints for real-time features:
1. Chat messaging — live message delivery + translation
2. Voice translation — audio STT → Translate → TTS pipeline
3. Presence — online/offline status

Protocol (JSON messages):

  === Chat ===
  Client → Server:
    { "type": "join_chat", "chat_id": "..." }
    { "type": "leave_chat", "chat_id": "..." }
    { "type": "message", "chat_id": "...", "content": "...", "message_type": "text" }
    { "type": "typing", "chat_id": "..." }

  Server → Client:
    { "type": "new_message", "data": { message object } }
    { "type": "typing", "data": { "chat_id": "...", "user_id": "...", "username": "..." } }
    { "type": "presence", "data": { "user_id": "...", "status": "online" } }
    { "type": "friend_request", "data": { ... } }

  === Voice Translation ===
    { "type": "audio", "data": "<base64 audio>" }
    { "type": "config", "source_lang": "th", "target_lang": "en" }

  Server → Client:
    { "type": "transcript", "data": "..." }
    { "type": "translation", "data": "..." }
    { "type": "audio", "data": "<base64 audio chunk>" }
    { "type": "metrics", "data": { ... } }
"""

import base64
import json
import traceback
from datetime import datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.database import async_session
from app.models.models import Chat, ChatMember, Message, User
from app.services.auth_service import decode_access_token
from app.services.pipeline import TranslationContext, pipeline
from app.services.redis_service import redis_service
from app.services.translation_service import translation_service

router = APIRouter()


# ─── Connection Manager ────────────────────────────────────

class ConnectionManager:
    """Manages WebSocket connections for all users."""

    def __init__(self):
        # user_id -> list of WebSocket connections (multi-device)
        self.active_connections: dict[str, list[WebSocket]] = {}
        # chat_id -> set of user_ids currently viewing that chat
        self.chat_viewers: dict[str, set[str]] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, user_id: str, websocket: WebSocket):
        if user_id in self.active_connections:
            self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        # Remove from all chat viewers
        for chat_id in list(self.chat_viewers.keys()):
            self.chat_viewers[chat_id].discard(user_id)

    def is_online(self, user_id: str) -> bool:
        return user_id in self.active_connections

    def join_chat(self, user_id: str, chat_id: str):
        if chat_id not in self.chat_viewers:
            self.chat_viewers[chat_id] = set()
        self.chat_viewers[chat_id].add(user_id)

    def leave_chat(self, user_id: str, chat_id: str):
        if chat_id in self.chat_viewers:
            self.chat_viewers[chat_id].discard(user_id)

    async def send_to_user(self, user_id: str, message: dict):
        """Send a message to all connections of a user."""
        if user_id in self.active_connections:
            dead = []
            for ws in self.active_connections[user_id]:
                try:
                    await ws.send_json(message)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                self.active_connections[user_id].remove(ws)

    async def broadcast_to_chat(self, chat_id: str, message: dict, exclude_user: str = ""):
        """Send a message to all members currently viewing a chat."""
        if chat_id in self.chat_viewers:
            for user_id in self.chat_viewers[chat_id]:
                if user_id != exclude_user:
                    await self.send_to_user(user_id, message)

    async def notify_chat_members(
        self, chat_id: str, message: dict, exclude_user: str = ""
    ):
        """Send to ALL members of a chat (not just viewers) — for notifications."""
        async with async_session() as db:
            result = await db.execute(
                select(ChatMember.user_id).where(ChatMember.chat_id == chat_id)
            )
            member_ids = [str(row[0]) for row in result.all()]

        for uid in member_ids:
            if uid != exclude_user:
                await self.send_to_user(uid, message)


manager = ConnectionManager()


# ─── Call Notification Helpers ──────────────────────────────

async def notify_incoming_call(
    chat_id: str,
    call_id: str,
    room_name: str,
    call_type: str,
    initiated_by: str,
    initiator_name: str,
    exclude_user: str = "",
):
    """Notify all chat members about an incoming call."""
    await manager.notify_chat_members(
        chat_id,
        {
            "type": "incoming_call",
            "data": {
                "call_id": call_id,
                "chat_id": chat_id,
                "room_name": room_name,
                "call_type": call_type,
                "initiated_by": initiated_by,
                "initiator_name": initiator_name,
            },
        },
        exclude_user=exclude_user,
    )


async def notify_call_ended(chat_id: str, call_id: str, ended_by: str, duration_seconds: float):
    """Notify all chat members that a call has ended."""
    await manager.notify_chat_members(
        chat_id,
        {
            "type": "call_ended",
            "data": {
                "call_id": call_id,
                "chat_id": chat_id,
                "ended_by": ended_by,
                "duration_seconds": duration_seconds,
            },
        },
    )


async def notify_participant_joined(
    chat_id: str, call_id: str, user_id: str, display_name: str, participant_count: int
):
    """Notify members that someone joined the call."""
    await manager.notify_chat_members(
        chat_id,
        {
            "type": "participant_joined",
            "data": {
                "call_id": call_id,
                "chat_id": chat_id,
                "user_id": user_id,
                "display_name": display_name,
                "participant_count": participant_count,
            },
        },
    )


async def notify_participant_left(
    chat_id: str, call_id: str, user_id: str, display_name: str, participant_count: int
):
    """Notify members that someone left the call."""
    await manager.notify_chat_members(
        chat_id,
        {
            "type": "participant_left",
            "data": {
                "call_id": call_id,
                "chat_id": chat_id,
                "user_id": user_id,
                "display_name": display_name,
                "participant_count": participant_count,
            },
        },
    )


async def notify_group_update(
    chat_id: str, event_type: str, data: dict, exclude_user: str = ""
):
    """Notify chat members about group changes (member added/removed, renamed)."""
    await manager.notify_chat_members(
        chat_id,
        {"type": event_type, "data": data},
        exclude_user=exclude_user,
    )


# ─── Main WebSocket Endpoint ───────────────────────────────

@router.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    """
    Main WebSocket — handles chat, presence, and voice translation.
    Authenticates via JWT token in the URL.
    """
    # Authenticate
    payload = decode_access_token(token)
    if not payload:
        await websocket.close(code=4001, reason="Invalid token")
        return

    user_id = payload["sub"]

    # Get user info
    async with async_session() as db:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            await websocket.close(code=4001, reason="User not found")
            return
        username = user.username
        preferred_lang = user.preferred_language

        # Update status
        user.status = "online"
        user.last_seen_at = datetime.utcnow()
        await db.commit()

    await manager.connect(user_id, websocket)

    # Notify friends of online status
    await _broadcast_presence(user_id, "online")

    # Voice translation context (for calls)
    voice_context = TranslationContext(
        user_id=user_id, source_language=preferred_lang
    )
    voice_id = None

    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            msg_type = msg.get("type", "")

            # ── Chat Messages ──
            if msg_type == "join_chat":
                chat_id = msg["chat_id"]
                manager.join_chat(user_id, chat_id)
                await websocket.send_json({"type": "joined_chat", "chat_id": chat_id})

            elif msg_type == "leave_chat":
                chat_id = msg["chat_id"]
                manager.leave_chat(user_id, chat_id)

            elif msg_type == "message":
                await _handle_chat_message(user_id, msg, websocket)

            elif msg_type == "typing":
                chat_id = msg["chat_id"]
                await manager.broadcast_to_chat(
                    chat_id,
                    {
                        "type": "typing",
                        "data": {
                            "chat_id": chat_id,
                            "user_id": user_id,
                            "username": username,
                        },
                    },
                    exclude_user=user_id,
                )

            elif msg_type == "mark_read":
                chat_id = msg["chat_id"]
                # Update last_read_at in DB
                async with async_session() as session:
                    result = await session.execute(
                        select(ChatMember).where(
                            ChatMember.chat_id == chat_id,
                            ChatMember.user_id == user_id,
                        )
                    )
                    membership = result.scalar_one_or_none()
                    if membership:
                        membership.last_read_at = datetime.utcnow()
                        await session.commit()
                        # Broadcast read receipt
                        await manager.broadcast_to_chat(
                            chat_id,
                            {
                                "type": "read_receipt",
                                "data": {
                                    "chat_id": chat_id,
                                    "user_id": user_id,
                                    "username": username,
                                    "read_at": membership.last_read_at.isoformat(),
                                },
                            },
                            exclude_user=user_id,
                        )

            # ── Voice Translation ──
            elif msg_type == "config":
                if "source_lang" in msg:
                    voice_context.source_language = msg["source_lang"]
                if "target_lang" in msg:
                    voice_context.target_language = msg["target_lang"]
                if "voice_id" in msg:
                    voice_id = msg["voice_id"]
                await websocket.send_json({"type": "config_ack", "data": "ok"})

            elif msg_type == "audio":
                audio_data = base64.b64decode(msg["data"])
                async for result in pipeline.process_audio_streaming(
                    audio_data=audio_data,
                    context=voice_context,
                    voice_id=voice_id,
                ):
                    if result["type"] == "audio":
                        await websocket.send_json({
                            "type": "audio",
                            "data": base64.b64encode(result["data"]).decode(),
                        })
                    else:
                        await websocket.send_json({
                            "type": result["type"],
                            "data": result["data"],
                        })

            # ── Call Events ──
            elif msg_type == "call_decline":
                call_id = msg.get("call_id", "")
                chat_id = msg.get("chat_id", "")
                if chat_id:
                    await manager.notify_chat_members(
                        chat_id,
                        {
                            "type": "call_declined",
                            "data": {
                                "call_id": call_id,
                                "chat_id": chat_id,
                                "user_id": user_id,
                                "username": username,
                            },
                        },
                        exclude_user=user_id,
                    )

            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        pass
    except Exception as e:
        traceback.print_exc()
        try:
            await websocket.send_json({"type": "error", "data": str(e)})
        except Exception:
            pass
    finally:
        manager.disconnect(user_id, websocket)
        # Update status to offline
        async with async_session() as db:
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            if user and not manager.is_online(user_id):
                user.status = "offline"
                user.last_seen_at = datetime.utcnow()
                await db.commit()
        await _broadcast_presence(user_id, "offline")


# ─── Internal Handlers ─────────────────────────────────────

async def _handle_chat_message(user_id: str, msg: dict, websocket: WebSocket):
    """Process an incoming chat message — translate and broadcast."""
    chat_id = msg["chat_id"]
    content = msg["content"]
    message_type = msg.get("message_type", "text")
    reply_to_id = msg.get("reply_to_id")

    async with async_session() as db:
        # Get chat + members
        result = await db.execute(
            select(Chat)
            .options(selectinload(Chat.members).selectinload(ChatMember.user))
            .where(Chat.id == chat_id)
        )
        chat = result.scalar_one_or_none()
        if not chat:
            await websocket.send_json({"type": "error", "data": "Chat not found"})
            return

        # Find sender's membership
        sender_membership = next(
            (m for m in chat.members if str(m.user_id) == user_id), None
        )
        if not sender_membership:
            await websocket.send_json({"type": "error", "data": "Not a member"})
            return

        source_lang = sender_membership.language

        # Translate to all needed languages
        target_langs = {m.language for m in chat.members if m.language != source_lang}
        translations = {source_lang: content}

        for tl in target_langs:
            try:
                translated = await translation_service.translate(
                    text=content,
                    source_language=source_lang,
                    target_language=tl,
                )
                translations[tl] = translated
            except Exception:
                translations[tl] = content

        # Save message
        message = Message(
            chat_id=chat.id,
            sender_id=user_id,
            content=content,
            source_language=source_lang,
            message_type=message_type,
            translations=translations,
            reply_to_id=reply_to_id,
        )
        db.add(message)
        chat.updated_at = datetime.utcnow()
        sender_membership.last_read_at = datetime.utcnow()
        await db.commit()
        await db.refresh(message)

        # Send personalized message to each member
        for member in chat.members:
            member_lang = member.language
            msg_data = {
                "id": str(message.id),
                "chat_id": str(chat.id),
                "sender_id": user_id,
                "sender_username": sender_membership.user.username,
                "sender_display_name": sender_membership.user.display_name,
                "content": content,
                "translated_content": translations.get(member_lang, content),
                "source_language": source_lang,
                "message_type": message_type,
                "reply_to_id": str(reply_to_id) if reply_to_id else None,
                "created_at": message.created_at.isoformat(),
            }
            await manager.send_to_user(
                str(member.user_id),
                {"type": "new_message", "data": msg_data},
            )


async def _broadcast_presence(user_id: str, status: str):
    """Broadcast presence update to all friends."""
    async with async_session() as db:
        from app.models.models import Friendship

        result = await db.execute(
            select(Friendship.friend_id).where(Friendship.user_id == user_id)
        )
        friend_ids = [str(row[0]) for row in result.all()]

    for fid in friend_ids:
        await manager.send_to_user(fid, {
            "type": "presence",
            "data": {"user_id": user_id, "status": status},
        })
