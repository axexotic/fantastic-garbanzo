"""AI analysis endpoints — summarize calls/chats, sentiment, entities, action items."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_current_user
from app.models.database import get_db
from app.models.models import Call, CallParticipant, Chat, ChatMember, Message, User
from app.services.ai_service import ai_service

router = APIRouter()


# ─── Schemas ────────────────────────────────────────────────

class AnalyzeTextRequest(BaseModel):
    text: str


# ─── Helpers ────────────────────────────────────────────────

async def _get_chat_transcript(
    chat_id: str, user_id: str, db: AsyncSession, limit: int = 200
) -> str:
    """Build a transcript string from chat messages."""
    # Verify membership
    result = await db.execute(
        select(ChatMember).where(
            ChatMember.chat_id == chat_id, ChatMember.user_id == user_id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member of this chat")

    result = await db.execute(
        select(Message)
        .options(selectinload(Message.sender))
        .where(Message.chat_id == chat_id, Message.is_deleted == False)
        .order_by(Message.created_at.asc())
        .limit(limit)
    )
    messages = result.scalars().all()
    if not messages:
        raise HTTPException(status_code=404, detail="No messages in this chat")

    lines = []
    for m in messages:
        name = m.sender.display_name if m.sender else "Unknown"
        lines.append(f"[{m.created_at.strftime('%H:%M')}] {name}: {m.content}")
    return "\n".join(lines)


async def _get_call_transcript(
    call_id: str, user_id: str, db: AsyncSession
) -> str:
    """Build a transcript from messages in the call's chat during call window."""
    result = await db.execute(select(Call).where(Call.id == call_id))
    call = result.scalar_one_or_none()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    # Verify user was a participant
    result = await db.execute(
        select(CallParticipant).where(
            CallParticipant.call_id == call_id,
            CallParticipant.user_id == user_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a participant of this call")

    # Get messages during the call window
    query = (
        select(Message)
        .options(selectinload(Message.sender))
        .where(Message.chat_id == call.chat_id, Message.is_deleted == False)
    )
    if call.started_at:
        query = query.where(Message.created_at >= call.started_at)
    if call.ended_at:
        query = query.where(Message.created_at <= call.ended_at)

    query = query.order_by(Message.created_at.asc()).limit(500)
    result = await db.execute(query)
    messages = result.scalars().all()

    if not messages:
        # Fallback: use recent chat messages
        return await _get_chat_transcript(str(call.chat_id), user_id, db, limit=100)

    lines = []
    for m in messages:
        name = m.sender.display_name if m.sender else "Unknown"
        lines.append(f"[{m.created_at.strftime('%H:%M')}] {name}: {m.content}")
    return "\n".join(lines)


# ─── Call-Level Endpoints ───────────────────────────────────

@router.post("/calls/{call_id}/summarize")
async def summarize_call(
    call_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate an AI summary of a call."""
    transcript = await _get_call_transcript(call_id, str(current_user.id), db)
    result = await ai_service.summarize(transcript)
    return {"call_id": call_id, **result}


@router.post("/calls/{call_id}/sentiment")
async def call_sentiment(
    call_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Analyze sentiment of a call."""
    transcript = await _get_call_transcript(call_id, str(current_user.id), db)
    result = await ai_service.sentiment(transcript)
    return {"call_id": call_id, **result}


@router.post("/calls/{call_id}/entities")
async def call_entities(
    call_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Extract entities from a call."""
    transcript = await _get_call_transcript(call_id, str(current_user.id), db)
    result = await ai_service.extract_entities(transcript)
    return {"call_id": call_id, **result}


@router.post("/calls/{call_id}/action-items")
async def call_action_items(
    call_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Extract action items from a call."""
    transcript = await _get_call_transcript(call_id, str(current_user.id), db)
    result = await ai_service.extract_action_items(transcript)
    return {"call_id": call_id, **result}


@router.post("/calls/{call_id}/full-analysis")
async def full_call_analysis(
    call_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Run full AI analysis on a call (summary, sentiment, entities, action items)."""
    transcript = await _get_call_transcript(call_id, str(current_user.id), db)
    result = await ai_service.full_analysis(transcript)
    return {"call_id": call_id, **result}


# ─── Chat-Level Endpoints ──────────────────────────────────

@router.post("/chats/{chat_id}/summarize")
async def summarize_chat(
    chat_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate an AI summary of recent chat messages."""
    transcript = await _get_chat_transcript(chat_id, str(current_user.id), db)
    result = await ai_service.summarize(transcript)
    return {"chat_id": chat_id, **result}


@router.post("/chats/{chat_id}/sentiment")
async def chat_sentiment(
    chat_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Analyze sentiment of a chat."""
    transcript = await _get_chat_transcript(chat_id, str(current_user.id), db)
    result = await ai_service.sentiment(transcript)
    return {"chat_id": chat_id, **result}


# ─── Freeform Text Analysis ────────────────────────────────

@router.post("/analyze/summarize")
async def analyze_text_summary(
    body: AnalyzeTextRequest,
    current_user: User = Depends(get_current_user),
):
    """Summarize arbitrary text."""
    return await ai_service.summarize(body.text)


@router.post("/analyze/sentiment")
async def analyze_text_sentiment(
    body: AnalyzeTextRequest,
    current_user: User = Depends(get_current_user),
):
    """Analyze sentiment of arbitrary text."""
    return await ai_service.sentiment(body.text)


@router.post("/analyze/entities")
async def analyze_text_entities(
    body: AnalyzeTextRequest,
    current_user: User = Depends(get_current_user),
):
    """Extract entities from arbitrary text."""
    return await ai_service.extract_entities(body.text)


@router.post("/analyze/action-items")
async def analyze_text_action_items(
    body: AnalyzeTextRequest,
    current_user: User = Depends(get_current_user),
):
    """Extract action items from arbitrary text."""
    return await ai_service.extract_action_items(body.text)
