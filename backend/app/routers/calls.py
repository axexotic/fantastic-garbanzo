"""Call history & management endpoints."""

import uuid
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_current_user
from app.models.database import get_db
from app.models.models import Call, CallParticipant, Chat, ChatMember, User
from app.services.daily_service import daily_service

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
        # Return existing call instead of creating new one
        return CallResponse(
            id=str(existing_call.id),
            chat_id=str(existing_call.chat_id),
            room_name=existing_call.room_name,
            room_url=existing_call.daily_room_url or "",
            call_type=existing_call.call_type,
            status=existing_call.status,
            initiated_by=str(existing_call.initiated_by),
        )

    # Count chat members to set max_participants for group calls
    members_result = await db.execute(
        select(ChatMember).where(ChatMember.chat_id == req.chat_id)
    )
    chat_members = members_result.scalars().all()
    max_participants = max(len(chat_members), 2)

    # Create Daily.co room
    room_name = f"call-{uuid.uuid4().hex[:12]}"
    try:
        room = await daily_service.create_room(room_name, max_participants=max_participants)
        room_url = room.get("url", f"https://your-domain.daily.co/{room_name}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create call room: {e}")

    # Create call record
    call = Call(
        chat_id=req.chat_id,
        room_name=room_name,
        daily_room_url=room_url,
        call_type=req.call_type,
        status="ringing",
        initiated_by=current_user.id,
        started_at=datetime.utcnow(),
    )
    db.add(call)
    await db.flush()  # Flush to assign call.id before creating participant

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

    return CallResponse(
        id=str(call.id),
        chat_id=str(call.chat_id),
        room_name=call.room_name,
        room_url=call.daily_room_url or "",
        call_type=call.call_type,
        status=call.status,
        initiated_by=str(call.initiated_by),
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

    # Get Daily.co meeting token
    try:
        token = await daily_service.get_meeting_token(call.room_name, str(current_user.id))
    except Exception:
        token = ""

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

    return {
        "token": token,
        "room_url": call.daily_room_url,
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

    return {"success": True, "duration_seconds": call.duration_seconds}


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
