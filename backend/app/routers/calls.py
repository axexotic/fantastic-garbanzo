"""Call history & management endpoints."""

import uuid
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_current_user
from app.models.database import get_db
from app.models.models import Call, CallParticipant, Chat, ChatMember, User
from app.services.livekit_service import livekit_service
from app.routers.websocket import (
    notify_incoming_call,
    notify_call_ended,
    notify_participant_joined,
    notify_participant_left,
)

router = APIRouter()


class StartCallRequest(BaseModel):
    chat_id: str
    call_type: Literal["voice", "video"] = "voice"


class CallResponse(BaseModel):
    id: str
    chat_id: str
    room_name: str
    room_url: str
    call_type: str
    status: str
    initiated_by: str
    token: str = ""


@router.post("/start", response_model=CallResponse)
async def start_call(
    req: StartCallRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start a new call in a chat."""
    # Verify user is a member of the chat
    result = await db.execute(
        select(ChatMember)
        .where(ChatMember.chat_id == req.chat_id)
        .where(ChatMember.user_id == current_user.id)
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this chat")

    # Check for existing active call
    result = await db.execute(
        select(Call)
        .where(Call.chat_id == req.chat_id)
        .where(Call.status.in_(["ringing", "active"]))
    )
    existing_call = result.scalar_one_or_none()
    if existing_call:
        # Generate a token for the user to join the existing call
        token = livekit_service.create_token(
            room_name=existing_call.room_name,
            participant_identity=str(current_user.id),
            participant_name=current_user.display_name,
        )
        return CallResponse(
            id=str(existing_call.id),
            chat_id=str(existing_call.chat_id),
            room_name=existing_call.room_name,
            room_url=livekit_service.get_ws_url(),
            call_type=existing_call.call_type,
            status=existing_call.status,
            initiated_by=str(existing_call.initiated_by),
            token=token,
        )

    # Create room name
    room_name = f"call-{uuid.uuid4().hex[:12]}"

    # Generate LiveKit token (room auto-creates on LiveKit server)
    lk_url = livekit_service.get_ws_url()
    token = livekit_service.create_token(
        room_name=room_name,
        participant_identity=str(current_user.id),
        participant_name=current_user.display_name,
    )

    # Create call record
    call = Call(
        chat_id=req.chat_id,
        room_name=room_name,
        daily_room_url=lk_url,  # Reusing column for LiveKit URL
        call_type=req.call_type,
        status="ringing",
        initiated_by=current_user.id,
        started_at=datetime.utcnow(),
    )
    db.add(call)
    await db.flush()

    # Add initiator as participant
    participant = CallParticipant(
        call_id=call.id,
        user_id=current_user.id,
        language=membership.language or current_user.preferred_language,
        status="joined",
        joined_at=datetime.utcnow(),
    )
    db.add(participant)

    await db.commit()

    # Notify other chat members about the incoming call
    await notify_incoming_call(
        chat_id=str(call.chat_id),
        call_id=str(call.id),
        room_name=call.room_name,
        call_type=call.call_type,
        initiated_by=str(current_user.id),
        initiator_name=current_user.display_name,
        exclude_user=str(current_user.id),
    )

    return CallResponse(
        id=str(call.id),
        chat_id=str(call.chat_id),
        room_name=call.room_name,
        room_url=lk_url,
        call_type=call.call_type,
        status=call.status,
        initiated_by=str(call.initiated_by),
        token=token,
    )


@router.post("/{call_id}/join")
async def join_call(
    call_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Join an existing call."""
    result = await db.execute(select(Call).where(Call.id == call_id))
    call = result.scalar_one_or_none()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    # Verify user is member of the chat
    result = await db.execute(
        select(ChatMember)
        .where(ChatMember.chat_id == call.chat_id)
        .where(ChatMember.user_id == current_user.id)
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this chat")

    # Generate LiveKit token
    token = livekit_service.create_token(
        room_name=call.room_name,
        participant_identity=str(current_user.id),
        participant_name=current_user.display_name,
    )

    # Add/update participant
    result = await db.execute(
        select(CallParticipant)
        .where(CallParticipant.call_id == call.id)
        .where(CallParticipant.user_id == current_user.id)
    )
    participant = result.scalar_one_or_none()
    if participant:
        participant.status = "joined"
        participant.joined_at = datetime.utcnow()
    else:
        participant = CallParticipant(
            call_id=call.id,
            user_id=current_user.id,
            language=membership.language or current_user.preferred_language,
            status="joined",
            joined_at=datetime.utcnow(),
        )
        db.add(participant)

    # Update call status if needed
    if call.status == "ringing":
        call.status = "active"

    await db.commit()

    # Count active participants for notification
    active_count_result = await db.execute(
        select(func.count(CallParticipant.id))
        .where(CallParticipant.call_id == call.id, CallParticipant.status == "joined")
    )
    active_count = active_count_result.scalar() or 0

    # Notify others that a participant joined
    await notify_participant_joined(
        chat_id=str(call.chat_id),
        call_id=str(call.id),
        user_id=str(current_user.id),
        display_name=current_user.display_name,
        participant_count=active_count,
    )

    return {
        "token": token,
        "server_url": livekit_service.get_ws_url(),
        "room_name": call.room_name,
    }


@router.post("/{call_id}/end")
async def end_call(
    call_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """End a call."""
    result = await db.execute(select(Call).where(Call.id == call_id))
    call = result.scalar_one_or_none()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    # Calculate duration
    if call.started_at:
        duration = (datetime.utcnow() - call.started_at).total_seconds()
        call.duration_seconds = duration

    call.status = "completed"
    call.ended_at = datetime.utcnow()

    await db.commit()

    # Notify all members that the call ended
    await notify_call_ended(
        chat_id=str(call.chat_id),
        call_id=str(call.id),
        ended_by=str(current_user.id),
        duration_seconds=call.duration_seconds or 0,
    )

    return {"success": True, "duration_seconds": call.duration_seconds}


@router.post("/{call_id}/leave")
async def leave_call(
    call_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Leave a call without ending it (for group calls)."""
    result = await db.execute(select(Call).where(Call.id == call_id))
    call = result.scalar_one_or_none()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    # Update participant status
    result = await db.execute(
        select(CallParticipant)
        .where(CallParticipant.call_id == call.id, CallParticipant.user_id == current_user.id)
    )
    participant = result.scalar_one_or_none()
    if participant:
        participant.status = "left"
        participant.left_at = datetime.utcnow()

    await db.commit()

    # Count remaining active participants
    active_result = await db.execute(
        select(func.count(CallParticipant.id))
        .where(CallParticipant.call_id == call.id, CallParticipant.status == "joined")
    )
    remaining = active_result.scalar() or 0

    # Notify others
    await notify_participant_left(
        chat_id=str(call.chat_id),
        call_id=str(call.id),
        user_id=str(current_user.id),
        display_name=current_user.display_name,
        participant_count=remaining,
    )

    # Auto-end call if no participants left
    if remaining == 0:
        if call.started_at:
            call.duration_seconds = (datetime.utcnow() - call.started_at).total_seconds()
        call.status = "completed"
        call.ended_at = datetime.utcnow()
        await db.commit()

        await notify_call_ended(
            chat_id=str(call.chat_id),
            call_id=str(call.id),
            ended_by=str(current_user.id),
            duration_seconds=call.duration_seconds or 0,
        )

    return {"success": True, "remaining_participants": remaining}


@router.post("/{call_id}/decline")
async def decline_call(
    call_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Decline an incoming call."""
    result = await db.execute(select(Call).where(Call.id == call_id))
    call = result.scalar_one_or_none()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    # Update participant to declined
    result = await db.execute(
        select(CallParticipant)
        .where(CallParticipant.call_id == call.id, CallParticipant.user_id == current_user.id)
    )
    participant = result.scalar_one_or_none()
    if participant:
        participant.status = "declined"
    else:
        db.add(CallParticipant(
            call_id=call.id,
            user_id=current_user.id,
            language=current_user.preferred_language,
            status="declined",
        ))

    await db.commit()
    return {"success": True}


@router.get("/{call_id}/participants")
async def get_call_participants(
    call_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all participants in a call with their status."""
    result = await db.execute(
        select(CallParticipant)
        .options(selectinload(CallParticipant.user))
        .where(CallParticipant.call_id == call_id)
    )
    participants = result.scalars().all()

    return {
        "participants": [
            {
                "user_id": str(p.user_id),
                "display_name": p.user.display_name if p.user else "Unknown",
                "username": p.user.username if p.user else "",
                "language": p.language,
                "status": p.status,
                "joined_at": p.joined_at.isoformat() if p.joined_at else None,
            }
            for p in participants
        ],
        "total": len(participants),
        "active": sum(1 for p in participants if p.status == "joined"),
    }


@router.get("/active/{chat_id}")
async def get_active_call(
    chat_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get active call for a chat if one exists."""
    result = await db.execute(
        select(Call)
        .where(Call.chat_id == chat_id)
        .where(Call.status.in_(["ringing", "active"]))
    )
    call = result.scalar_one_or_none()

    if not call:
        return None

    return CallResponse(
        id=str(call.id),
        chat_id=str(call.chat_id),
        room_name=call.room_name,
        room_url=call.daily_room_url or "",
        call_type=call.call_type,
        status=call.status,
        initiated_by=str(call.initiated_by),
    )


@router.get("/")
async def list_calls(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List recent calls for the current user."""
    result = await db.execute(
        select(Call)
        .join(CallParticipant)
        .where(CallParticipant.user_id == current_user.id)
        .order_by(Call.started_at.desc())
        .limit(50)
    )
    calls = result.scalars().all()

    return {
        "calls": [
            {
                "id": str(c.id),
                "chat_id": str(c.chat_id),
                "room_name": c.room_name,
                "call_type": c.call_type,
                "status": c.status,
                "duration_seconds": c.duration_seconds,
                "started_at": c.started_at.isoformat() if c.started_at else None,
            }
            for c in calls
        ],
        "total": len(calls),
    }


# ─── Call Recording ─────────────────────────────────────────

@router.post("/{call_id}/recording/start")
async def start_recording(
    call_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a call as being recorded."""
    result = await db.execute(select(Call).where(Call.id == call_id))
    call = result.scalar_one_or_none()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    if str(call.initiated_by) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Only the call initiator can start recording")

    call.is_recorded = True
    await db.commit()

    return {"call_id": str(call.id), "recording": True}


@router.post("/{call_id}/recording/stop")
async def stop_recording(
    call_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stop recording and save metadata."""
    result = await db.execute(select(Call).where(Call.id == call_id))
    call = result.scalar_one_or_none()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    call.is_recorded = True  # keep as recorded
    await db.commit()

    return {"call_id": str(call.id), "recording": False, "recorded": True}


@router.post("/{call_id}/recording/metadata")
async def save_recording_metadata(
    call_id: str,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save recording metadata (S3 key, size, duration) after upload."""
    result = await db.execute(select(Call).where(Call.id == call_id))
    call = result.scalar_one_or_none()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    if body.get("s3_key"):
        call.recording_s3_key = body["s3_key"]
    if body.get("url"):
        call.recording_url = body["url"]
    if body.get("size_bytes"):
        call.recording_size_bytes = body["size_bytes"]
    if body.get("duration_seconds"):
        call.recording_duration_seconds = body["duration_seconds"]

    call.is_recorded = True
    await db.commit()

    return {
        "call_id": str(call.id),
        "recording_url": call.recording_url,
        "recording_s3_key": call.recording_s3_key,
        "recording_size_bytes": call.recording_size_bytes,
        "recording_duration_seconds": call.recording_duration_seconds,
    }


@router.get("/{call_id}/recording")
async def get_recording_info(
    call_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get recording metadata for a call."""
    result = await db.execute(select(Call).where(Call.id == call_id))
    call = result.scalar_one_or_none()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    # Verify user is a participant
    participant = await db.execute(
        select(CallParticipant).where(
            CallParticipant.call_id == call_id,
            CallParticipant.user_id == current_user.id,
        )
    )
    if not participant.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a participant in this call")

    if not call.is_recorded:
        return {"call_id": str(call.id), "recorded": False}

    return {
        "call_id": str(call.id),
        "recorded": True,
        "recording_url": call.recording_url,
        "recording_s3_key": call.recording_s3_key,
        "recording_size_bytes": call.recording_size_bytes,
        "recording_duration_seconds": call.recording_duration_seconds,
    }
