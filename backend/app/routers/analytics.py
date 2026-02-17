"""Analytics router — call analytics, user engagement, system metrics."""

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user
from app.models.database import get_db
from app.models.models import Call, CallParticipant, User, Message, Chat, ChatMember
from app.services.redis_service import redis_service

router = APIRouter()


@router.get("/calls/summary")
async def call_summary(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get call summary stats for the current user."""
    since = datetime.utcnow() - timedelta(days=days)

    # Total calls participated
    result = await db.execute(
        select(func.count(CallParticipant.id))
        .where(CallParticipant.user_id == current_user.id)
        .join(Call, Call.id == CallParticipant.call_id)
        .where(Call.created_at >= since)
    )
    total_calls = result.scalar() or 0

    # Calls by type
    result = await db.execute(
        select(Call.call_type, func.count(Call.id))
        .join(CallParticipant, CallParticipant.call_id == Call.id)
        .where(CallParticipant.user_id == current_user.id)
        .where(Call.created_at >= since)
        .group_by(Call.call_type)
    )
    calls_by_type = {row[0]: row[1] for row in result.all()}

    # Total duration (from calls with ended_at)
    result = await db.execute(
        select(func.sum(
            func.extract("epoch", Call.ended_at) - func.extract("epoch", Call.created_at)
        ))
        .join(CallParticipant, CallParticipant.call_id == Call.id)
        .where(CallParticipant.user_id == current_user.id)
        .where(Call.created_at >= since)
        .where(Call.ended_at.isnot(None))
    )
    total_seconds = result.scalar() or 0

    # Average call duration
    result = await db.execute(
        select(func.avg(
            func.extract("epoch", Call.ended_at) - func.extract("epoch", Call.created_at)
        ))
        .join(CallParticipant, CallParticipant.call_id == Call.id)
        .where(CallParticipant.user_id == current_user.id)
        .where(Call.created_at >= since)
        .where(Call.ended_at.isnot(None))
    )
    avg_duration = round(result.scalar() or 0, 1)

    return {
        "period_days": days,
        "total_calls": total_calls,
        "calls_by_type": calls_by_type,
        "total_duration_seconds": round(total_seconds, 1),
        "total_duration_formatted": _fmt_duration(total_seconds),
        "avg_duration_seconds": avg_duration,
        "avg_duration_formatted": _fmt_duration(avg_duration),
    }


@router.get("/calls/history")
async def call_history(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    call_type: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get detailed call history with pagination."""
    query = (
        select(Call)
        .join(CallParticipant, CallParticipant.call_id == Call.id)
        .where(CallParticipant.user_id == current_user.id)
        .order_by(Call.created_at.desc())
    )
    if call_type:
        query = query.where(Call.call_type == call_type)

    # Total count
    count_q = (
        select(func.count(Call.id))
        .join(CallParticipant, CallParticipant.call_id == Call.id)
        .where(CallParticipant.user_id == current_user.id)
    )
    if call_type:
        count_q = count_q.where(Call.call_type == call_type)
    total = (await db.execute(count_q)).scalar() or 0

    calls = (
        await db.execute(query.offset((page - 1) * per_page).limit(per_page))
    ).scalars().all()

    items = []
    for c in calls:
        dur = None
        if c.ended_at and c.created_at:
            dur = (c.ended_at - c.created_at).total_seconds()
        items.append({
            "id": str(c.id),
            "chat_id": str(c.chat_id),
            "call_type": c.call_type,
            "status": c.status,
            "initiated_by": str(c.initiated_by),
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "ended_at": c.ended_at.isoformat() if c.ended_at else None,
            "duration_seconds": dur,
            "duration_formatted": _fmt_duration(dur) if dur else None,
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": max(1, (total + per_page - 1) // per_page),
    }


@router.get("/messages/summary")
async def message_summary(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get message statistics."""
    since = datetime.utcnow() - timedelta(days=days)

    result = await db.execute(
        select(func.count(Message.id))
        .where(Message.sender_id == current_user.id)
        .where(Message.created_at >= since)
    )
    sent = result.scalar() or 0

    # By type
    result = await db.execute(
        select(Message.message_type, func.count(Message.id))
        .where(Message.sender_id == current_user.id)
        .where(Message.created_at >= since)
        .group_by(Message.message_type)
    )
    by_type = {row[0]: row[1] for row in result.all()}

    # Messages per day (last 7 days)
    daily = []
    for i in range(min(days, 7)):
        day_start = datetime.utcnow().replace(hour=0, minute=0, second=0) - timedelta(days=i)
        day_end = day_start + timedelta(days=1)
        result = await db.execute(
            select(func.count(Message.id))
            .where(Message.sender_id == current_user.id)
            .where(Message.created_at >= day_start)
            .where(Message.created_at < day_end)
        )
        daily.append({
            "date": day_start.strftime("%Y-%m-%d"),
            "count": result.scalar() or 0,
        })

    return {
        "period_days": days,
        "total_sent": sent,
        "by_type": by_type,
        "daily": list(reversed(daily)),
    }


@router.get("/engagement")
async def engagement_metrics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Overall engagement metrics for the user."""
    since = datetime.utcnow() - timedelta(days=30)

    # Active chats (chats with messages in last 30 days)
    result = await db.execute(
        select(func.count(func.distinct(Message.chat_id)))
        .where(Message.sender_id == current_user.id)
        .where(Message.created_at >= since)
    )
    active_chats = result.scalar() or 0

    # Total friends (via chat memberships)
    result = await db.execute(
        select(func.count(ChatMember.id))
        .join(Chat, Chat.id == ChatMember.chat_id)
        .where(ChatMember.user_id == current_user.id)
    )
    total_chats = result.scalar() or 0

    # Calls this month
    result = await db.execute(
        select(func.count(CallParticipant.id))
        .join(Call, Call.id == CallParticipant.call_id)
        .where(CallParticipant.user_id == current_user.id)
        .where(Call.created_at >= since)
    )
    calls_this_month = result.scalar() or 0

    # Peak hours (most active message hours)
    result = await db.execute(
        select(
            func.extract("hour", Message.created_at).label("hour"),
            func.count(Message.id).label("cnt"),
        )
        .where(Message.sender_id == current_user.id)
        .where(Message.created_at >= since)
        .group_by("hour")
        .order_by(func.count(Message.id).desc())
        .limit(3)
    )
    peak_hours = [{"hour": int(row[0]), "message_count": row[1]} for row in result.all()]

    return {
        "active_chats_30d": active_chats,
        "total_chats": total_chats,
        "calls_30d": calls_this_month,
        "peak_hours": peak_hours,
        "engagement_score": min(100, active_chats * 10 + calls_this_month * 15),
    }


@router.get("/translation/usage")
async def translation_usage(
    current_user: User = Depends(get_current_user),
):
    """Get translation usage stats from Redis."""
    import json
    key = f"user:{current_user.id}:translation_usage"
    raw = await redis_service.get(key)
    if raw:
        return json.loads(raw)
    return {
        "total_translations": 0,
        "characters_translated": 0,
        "languages_used": [],
        "voice_translations": 0,
    }


def _fmt_duration(seconds) -> str:
    """Format seconds into human-friendly string."""
    if not seconds or seconds < 0:
        return "0s"
    seconds = int(seconds)
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    parts = []
    if h:
        parts.append(f"{h}h")
    if m:
        parts.append(f"{m}m")
    parts.append(f"{s}s")
    return " ".join(parts)
