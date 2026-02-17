"""Advanced call features router — hold, transfer, reactions, polls, whiteboard, etc."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.models.models import User
from app.services.call_features_service import call_features
from app.services.ai_features_service import ai_features
from app.services.security_service import security_service
from app.routers.websocket import manager

router = APIRouter()


# ─── Request Models ──────────────────────────────────────────

class HoldRequest(BaseModel):
    call_id: str

class TransferRequest(BaseModel):
    call_id: str
    to_user_id: str
    chat_id: str

class LockRequest(BaseModel):
    call_id: str
    password: str

class ReactionRequest(BaseModel):
    call_id: str
    chat_id: str
    emoji: str

class RaiseHandRequest(BaseModel):
    call_id: str
    chat_id: str

class PollCreateRequest(BaseModel):
    call_id: str
    chat_id: str
    question: str
    options: list[str]

class PollVoteRequest(BaseModel):
    call_id: str
    chat_id: str
    poll_id: str
    option: str

class SpeakingRequest(BaseModel):
    call_id: str
    speaking: bool

class WhiteboardRequest(BaseModel):
    call_id: str
    chat_id: str
    action: str  # "draw", "clear", "undo"
    data: dict = {}

class FileSendRequest(BaseModel):
    call_id: str
    chat_id: str
    file_name: str
    file_url: str
    file_size: int

class InCallChatRequest(BaseModel):
    call_id: str
    chat_id: str
    content: str

class AIAssistantRequest(BaseModel):
    call_id: str
    context: str = ""
    transcript: str = ""

class RoleRequest(BaseModel):
    call_id: str
    user_id: str
    role: str  # host, co-host, participant, viewer


# ─── Call Hold / Resume ──────────────────────────────────────

@router.post("/hold")
async def hold_call(req: HoldRequest, current_user: User = Depends(get_current_user)):
    await call_features.hold_call(req.call_id, str(current_user.id))
    return {"status": "on_hold", "call_id": req.call_id}


@router.post("/resume")
async def resume_call(req: HoldRequest, current_user: User = Depends(get_current_user)):
    await call_features.resume_call(req.call_id, str(current_user.id))
    return {"status": "resumed", "call_id": req.call_id}


# ─── Call Transfer ───────────────────────────────────────────

@router.post("/transfer")
async def transfer_call(req: TransferRequest, current_user: User = Depends(get_current_user)):
    result = await call_features.initiate_transfer(
        req.call_id, str(current_user.id), req.to_user_id, req.chat_id
    )
    # Notify the target user
    await manager.send_to_user(req.to_user_id, {
        "type": "call_transfer",
        "data": {
            "call_id": req.call_id,
            "from_user": str(current_user.id),
            "from_name": current_user.display_name,
            "chat_id": req.chat_id,
            "transfer_id": result["transfer_id"],
        },
    })
    return result


# ─── Call Lock ───────────────────────────────────────────────

@router.post("/lock")
async def lock_call(req: LockRequest, current_user: User = Depends(get_current_user)):
    role = await security_service.get_call_role(req.call_id, str(current_user.id))
    if role not in ("host", "co-host"):
        raise HTTPException(403, "Only host/co-host can lock calls")
    await call_features.lock_call(req.call_id, req.password)
    return {"locked": True}


@router.post("/unlock")
async def unlock_call(req: HoldRequest, current_user: User = Depends(get_current_user)):
    await call_features.unlock_call(req.call_id)
    return {"locked": False}


@router.post("/verify-lock")
async def verify_lock(req: LockRequest, current_user: User = Depends(get_current_user)):
    ok = await call_features.verify_call_lock(req.call_id, req.password)
    if not ok:
        raise HTTPException(403, "Incorrect password")
    return {"verified": True}


# ─── Emoji Reactions ─────────────────────────────────────────

@router.post("/reaction")
async def send_reaction(req: ReactionRequest, current_user: User = Depends(get_current_user)):
    reaction = await call_features.send_reaction(req.call_id, str(current_user.id), req.emoji)
    # Broadcast to all call participants via chat members
    await manager.notify_chat_members(req.chat_id, {
        "type": "call_reaction",
        "data": {
            "call_id": req.call_id,
            "user_id": str(current_user.id),
            "display_name": current_user.display_name,
            "emoji": req.emoji,
        },
    })
    return reaction


# ─── Raise Hand ──────────────────────────────────────────────

@router.post("/raise-hand")
async def raise_hand(req: RaiseHandRequest, current_user: User = Depends(get_current_user)):
    await call_features.raise_hand(req.call_id, str(current_user.id))
    await manager.notify_chat_members(req.chat_id, {
        "type": "hand_raised",
        "data": {
            "call_id": req.call_id,
            "user_id": str(current_user.id),
            "display_name": current_user.display_name,
        },
    })
    return {"raised": True}


@router.post("/lower-hand")
async def lower_hand(req: RaiseHandRequest, current_user: User = Depends(get_current_user)):
    await call_features.lower_hand(req.call_id, str(current_user.id))
    await manager.notify_chat_members(req.chat_id, {
        "type": "hand_lowered",
        "data": {
            "call_id": req.call_id,
            "user_id": str(current_user.id),
        },
    })
    return {"raised": False}


# ─── Polls ───────────────────────────────────────────────────

@router.post("/poll/create")
async def create_poll(req: PollCreateRequest, current_user: User = Depends(get_current_user)):
    poll = await call_features.create_poll(req.call_id, str(current_user.id), req.question, req.options)
    await manager.notify_chat_members(req.chat_id, {
        "type": "poll_created",
        "data": {
            **poll,
            "creator_name": current_user.display_name,
        },
    })
    return poll


@router.post("/poll/vote")
async def vote_poll(req: PollVoteRequest, current_user: User = Depends(get_current_user)):
    poll = await call_features.vote_poll(req.call_id, req.poll_id, str(current_user.id), req.option)
    await manager.notify_chat_members(req.chat_id, {
        "type": "poll_updated",
        "data": poll,
    })
    return poll


# ─── Speaking Time Tracking ──────────────────────────────────

@router.post("/speaking")
async def update_speaking(req: SpeakingRequest, current_user: User = Depends(get_current_user)):
    if req.speaking:
        await call_features.start_speaking(req.call_id, str(current_user.id))
    else:
        total = await call_features.stop_speaking(req.call_id, str(current_user.id))
        return {"speaking": False, "total_seconds": total}
    return {"speaking": True}


@router.get("/{call_id}/speaking-time")
async def get_speaking_time(call_id: str, current_user: User = Depends(get_current_user)):
    time = await call_features.get_speaking_time(call_id, str(current_user.id))
    return {"call_id": call_id, "speaking_seconds": time}


@router.get("/{call_id}/engagement")
async def get_engagement(call_id: str, current_user: User = Depends(get_current_user)):
    return await call_features.calculate_engagement(call_id, str(current_user.id))


# ─── Whiteboard ──────────────────────────────────────────────

@router.post("/whiteboard")
async def whiteboard_action(req: WhiteboardRequest, current_user: User = Depends(get_current_user)):
    await manager.notify_chat_members(req.chat_id, {
        "type": "whiteboard_action",
        "data": {
            "call_id": req.call_id,
            "user_id": str(current_user.id),
            "display_name": current_user.display_name,
            "action": req.action,
            "data": req.data,
        },
    }, exclude_user=str(current_user.id))
    return {"success": True}


# ─── In-Call File Sharing ────────────────────────────────────

@router.post("/share-file")
async def share_file(req: FileSendRequest, current_user: User = Depends(get_current_user)):
    await manager.notify_chat_members(req.chat_id, {
        "type": "call_file_shared",
        "data": {
            "call_id": req.call_id,
            "user_id": str(current_user.id),
            "display_name": current_user.display_name,
            "file_name": req.file_name,
            "file_url": req.file_url,
            "file_size": req.file_size,
        },
    })
    return {"success": True}


# ─── In-Call Chat ────────────────────────────────────────────

@router.post("/in-call-chat")
async def in_call_chat(req: InCallChatRequest, current_user: User = Depends(get_current_user)):
    await manager.notify_chat_members(req.chat_id, {
        "type": "in_call_message",
        "data": {
            "call_id": req.call_id,
            "user_id": str(current_user.id),
            "display_name": current_user.display_name,
            "content": req.content,
        },
    })
    return {"success": True}


# ─── AI Features ─────────────────────────────────────────────

@router.get("/ai/audio-config")
async def get_ai_audio_config(current_user: User = Depends(get_current_user)):
    return await ai_features.get_ai_audio_config()


@router.get("/ai/video-config")
async def get_ai_video_config(current_user: User = Depends(get_current_user)):
    return await ai_features.get_ai_video_config()


@router.post("/ai/detect-tone")
async def detect_tone(body: dict, current_user: User = Depends(get_current_user)):
    return await ai_features.detect_tone(body.get("text", ""))


@router.post("/ai/meeting-notes")
async def auto_meeting_notes(body: dict, current_user: User = Depends(get_current_user)):
    return await ai_features.auto_generate_meeting_notes(
        body.get("transcript", ""),
        body.get("participants", []),
    )


@router.post("/ai/suggestion")
async def ai_suggestion(req: AIAssistantRequest, current_user: User = Depends(get_current_user)):
    return await ai_features.get_ai_suggestion(req.context, req.transcript)


@router.post("/ai/interrupt-detect")
async def detect_interruption(body: dict, current_user: User = Depends(get_current_user)):
    return await ai_features.detect_interruption(body.get("speakers", []))


@router.post("/ai/moderate")
async def moderate_meeting(body: dict, current_user: User = Depends(get_current_user)):
    return await ai_features.moderate_meeting(
        body.get("speaking_times", {}),
        body.get("total_duration", 0),
    )


@router.post("/ai/stress-analysis")
async def stress_analysis(body: dict, current_user: User = Depends(get_current_user)):
    return await ai_features.analyze_voice_stress(body.get("text", ""))


@router.get("/ai/voice-styles")
async def voice_styles(current_user: User = Depends(get_current_user)):
    return await ai_features.get_voice_styles()


@router.post("/ai/digital-twin")
async def digital_twin(body: dict, current_user: User = Depends(get_current_user)):
    return await ai_features.digital_twin_respond(
        body.get("user_profile", {}),
        body.get("context", ""),
        body.get("message", ""),
    )


# ─── Security / Roles ───────────────────────────────────────

@router.post("/role")
async def set_role(req: RoleRequest, current_user: User = Depends(get_current_user)):
    # Only host can set roles
    caller_role = await security_service.get_call_role(req.call_id, str(current_user.id))
    if caller_role != "host":
        raise HTTPException(403, "Only host can assign roles")
    await security_service.set_call_role(req.call_id, req.user_id, req.role)
    return {"user_id": req.user_id, "role": req.role}


@router.get("/{call_id}/permissions")
async def get_permissions(call_id: str, current_user: User = Depends(get_current_user)):
    return await security_service.get_call_permissions(call_id, str(current_user.id))
