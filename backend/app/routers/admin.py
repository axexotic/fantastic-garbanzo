"""Admin router — user management, system stats, translation logs."""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user
from app.models.database import get_db
from app.models.models import (
    Call,
    Chat,
    Message,
    TranslationLog,
    User,
)

router = APIRouter()

# ─── Admin Guard ────────────────────────────────────────────

ADMIN_EMAILS = {"admin@flaskai.xyz"}  # Configure via env in production


async def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """Verify the current user has admin privileges."""
    if current_user.email not in ADMIN_EMAILS:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


# ─── Schemas ────────────────────────────────────────────────

class AdminUserResponse(BaseModel):
    id: str
    email: str
    username: str
    display_name: str
    preferred_language: str
    status: str
    is_active: bool
    created_at: str
    last_seen_at: str | None


class SystemStats(BaseModel):
    total_users: int
    active_users_24h: int
    total_chats: int
    total_messages: int
    total_calls: int
    total_translations: int
    avg_translation_latency_ms: float | None


class TranslationLogEntry(BaseModel):
    id: str
    source_language: str
    target_language: str
    source_text: str
    translated_text: str
    latency_ms: float | None
    model_used: str | None
    created_at: str


# ─── System Stats ───────────────────────────────────────────

@router.get("/stats", response_model=SystemStats)
async def system_stats(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Overview stats for the admin dashboard."""
    now = datetime.utcnow()
    yesterday = now - timedelta(hours=24)

    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    active_24h = (
        await db.execute(
            select(func.count(User.id)).where(User.last_seen_at >= yesterday)
        )
    ).scalar() or 0
    total_chats = (await db.execute(select(func.count(Chat.id)))).scalar() or 0
    total_messages = (await db.execute(select(func.count(Message.id)))).scalar() or 0
    total_calls = (await db.execute(select(func.count(Call.id)))).scalar() or 0
    total_translations = (await db.execute(select(func.count(TranslationLog.id)))).scalar() or 0
    avg_latency = (
        await db.execute(select(func.avg(TranslationLog.latency_ms)))
    ).scalar()

    return SystemStats(
        total_users=total_users,
        active_users_24h=active_24h,
        total_chats=total_chats,
        total_messages=total_messages,
        total_calls=total_calls,
        total_translations=total_translations,
        avg_translation_latency_ms=round(avg_latency, 2) if avg_latency else None,
    )


# ─── User Management ───────────────────────────────────────

@router.get("/users", response_model=list[AdminUserResponse])
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: str = Query("", description="Search by email or username"),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """List all users with optional search."""
    query = select(User).order_by(desc(User.created_at)).offset(skip).limit(limit)

    if search:
        pattern = f"%{search}%"
        query = query.where(
            User.email.ilike(pattern) | User.username.ilike(pattern)
        )

    result = await db.execute(query)
    users = result.scalars().all()

    return [
        AdminUserResponse(
            id=str(u.id),
            email=u.email,
            username=u.username,
            display_name=u.display_name,
            preferred_language=u.preferred_language,
            status=u.status,
            is_active=u.is_active,
            created_at=u.created_at.isoformat() if u.created_at else "",
            last_seen_at=u.last_seen_at.isoformat() if u.last_seen_at else None,
        )
        for u in users
    ]


@router.patch("/users/{user_id}/toggle-active")
async def toggle_user_active(
    user_id: str,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Enable or disable a user account."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = not user.is_active
    await db.commit()
    return {"id": str(user.id), "is_active": user.is_active}


# ─── Translation Logs ──────────────────────────────────────

@router.get("/translation-logs", response_model=list[TranslationLogEntry])
async def list_translation_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    source_lang: str = Query("", description="Filter by source language"),
    target_lang: str = Query("", description="Filter by target language"),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Browse translation logs for analytics."""
    query = (
        select(TranslationLog)
        .order_by(desc(TranslationLog.created_at))
        .offset(skip)
        .limit(limit)
    )

    if source_lang:
        query = query.where(TranslationLog.source_language == source_lang)
    if target_lang:
        query = query.where(TranslationLog.target_language == target_lang)

    result = await db.execute(query)
    logs = result.scalars().all()

    return [
        TranslationLogEntry(
            id=str(log.id),
            source_language=log.source_language,
            target_language=log.target_language,
            source_text=log.source_text[:200],  # Truncate for list view
            translated_text=log.translated_text[:200],
            latency_ms=log.latency_ms,
            model_used=log.model_used,
            created_at=log.created_at.isoformat() if log.created_at else "",
        )
        for log in logs
    ]


# ─── Translation Analytics ─────────────────────────────────

@router.get("/analytics/languages")
async def language_analytics(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Get translation count per language pair."""
    result = await db.execute(
        select(
            TranslationLog.source_language,
            TranslationLog.target_language,
            func.count(TranslationLog.id).label("count"),
            func.avg(TranslationLog.latency_ms).label("avg_latency_ms"),
        )
        .group_by(TranslationLog.source_language, TranslationLog.target_language)
        .order_by(func.count(TranslationLog.id).desc())
        .limit(20)
    )
    rows = result.all()
    return [
        {
            "source": r.source_language,
            "target": r.target_language,
            "count": r.count,
            "avg_latency_ms": round(r.avg_latency_ms, 1) if r.avg_latency_ms else None,
        }
        for r in rows
    ]
