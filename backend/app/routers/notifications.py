"""Notification preferences endpoints."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user
from app.models.database import get_db
from app.models.models import NotificationPreference, User

router = APIRouter()


class NotificationPrefsResponse(BaseModel):
    email_messages: bool
    email_calls: bool
    email_friend_requests: bool
    push_messages: bool
    push_calls: bool
    push_friend_requests: bool
    sound_enabled: bool
    ringtone: str
    notification_tone: str
    group_tone: str
    vibration_enabled: bool
    dnd_enabled: bool
    dnd_start: str
    dnd_end: str


class UpdateNotificationPrefsRequest(BaseModel):
    email_messages: bool | None = None
    email_calls: bool | None = None
    email_friend_requests: bool | None = None
    push_messages: bool | None = None
    push_calls: bool | None = None
    push_friend_requests: bool | None = None
    sound_enabled: bool | None = None
    ringtone: str | None = None
    notification_tone: str | None = None
    group_tone: str | None = None
    vibration_enabled: bool | None = None
    dnd_enabled: bool | None = None
    dnd_start: str | None = None
    dnd_end: str | None = None


def _prefs_to_dict(p: NotificationPreference) -> dict:
    return {
        "email_messages": p.email_messages,
        "email_calls": p.email_calls,
        "email_friend_requests": p.email_friend_requests,
        "push_messages": p.push_messages,
        "push_calls": p.push_calls,
        "push_friend_requests": p.push_friend_requests,
        "sound_enabled": p.sound_enabled,
        "ringtone": p.ringtone or "default",
        "notification_tone": p.notification_tone or "default",
        "group_tone": p.group_tone or "default",
        "vibration_enabled": p.vibration_enabled if p.vibration_enabled is not None else True,
        "dnd_enabled": p.dnd_enabled,
        "dnd_start": p.dnd_start or "22:00",
        "dnd_end": p.dnd_end or "08:00",
    }


@router.get("/", response_model=NotificationPrefsResponse)
async def get_notification_prefs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get notification preferences (creates defaults if not yet set)."""
    result = await db.execute(
        select(NotificationPreference).where(
            NotificationPreference.user_id == current_user.id
        )
    )
    prefs = result.scalar_one_or_none()

    if not prefs:
        prefs = NotificationPreference(user_id=current_user.id)
        db.add(prefs)
        await db.commit()
        await db.refresh(prefs)

    return _prefs_to_dict(prefs)


@router.patch("/", response_model=NotificationPrefsResponse)
async def update_notification_prefs(
    body: UpdateNotificationPrefsRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update notification preferences."""
    result = await db.execute(
        select(NotificationPreference).where(
            NotificationPreference.user_id == current_user.id
        )
    )
    prefs = result.scalar_one_or_none()

    if not prefs:
        prefs = NotificationPreference(user_id=current_user.id)
        db.add(prefs)
        await db.flush()

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(prefs, field, value)

    await db.commit()
    await db.refresh(prefs)
    return _prefs_to_dict(prefs)
