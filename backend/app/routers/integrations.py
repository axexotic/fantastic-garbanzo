"""Third-party integrations — webhook management, Slack, Teams, calendar."""

import uuid
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user
from app.models.database import get_db
from app.models.models import User, WebhookConfig
from app.services.webhook_service import WebhookProvider, webhook_service

router = APIRouter()


# ─── Schemas ────────────────────────────────────────────────

class CreateWebhookRequest(BaseModel):
    name: str
    provider: Literal["slack", "teams", "generic"]
    webhook_url: str
    events: list[str] = ["message", "call_started", "call_ended"]


class UpdateWebhookRequest(BaseModel):
    name: str | None = None
    webhook_url: str | None = None
    events: list[str] | None = None
    is_active: bool | None = None


class TestWebhookRequest(BaseModel):
    webhook_id: str


# ─── Endpoints ──────────────────────────────────────────────

@router.get("/webhooks")
async def list_webhooks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all configured webhooks for the current user."""
    result = await db.execute(
        select(WebhookConfig).where(WebhookConfig.user_id == current_user.id)
    )
    webhooks = result.scalars().all()
    return [
        {
            "id": str(w.id),
            "name": w.name,
            "provider": w.provider,
            "webhook_url": w.webhook_url[:20] + "***",  # mask URL
            "events": w.events or [],
            "is_active": w.is_active,
            "created_at": w.created_at.isoformat(),
        }
        for w in webhooks
    ]


@router.post("/webhooks")
async def create_webhook(
    body: CreateWebhookRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register a new webhook endpoint."""
    webhook = WebhookConfig(
        user_id=current_user.id,
        name=body.name,
        provider=body.provider,
        webhook_url=body.webhook_url,
        events=body.events,
        is_active=True,
    )
    db.add(webhook)
    await db.commit()
    await db.refresh(webhook)
    return {
        "id": str(webhook.id),
        "name": webhook.name,
        "provider": webhook.provider,
        "events": webhook.events,
        "is_active": True,
    }


@router.patch("/webhooks/{webhook_id}")
async def update_webhook(
    webhook_id: str,
    body: UpdateWebhookRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update webhook configuration."""
    result = await db.execute(
        select(WebhookConfig).where(
            WebhookConfig.id == webhook_id, WebhookConfig.user_id == current_user.id
        )
    )
    webhook = result.scalar_one_or_none()
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    if body.name is not None:
        webhook.name = body.name
    if body.webhook_url is not None:
        webhook.webhook_url = body.webhook_url
    if body.events is not None:
        webhook.events = body.events
    if body.is_active is not None:
        webhook.is_active = body.is_active

    await db.commit()
    return {"status": "updated"}


@router.delete("/webhooks/{webhook_id}")
async def delete_webhook(
    webhook_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a webhook."""
    result = await db.execute(
        select(WebhookConfig).where(
            WebhookConfig.id == webhook_id, WebhookConfig.user_id == current_user.id
        )
    )
    webhook = result.scalar_one_or_none()
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    await db.delete(webhook)
    await db.commit()
    return {"status": "deleted"}


@router.post("/webhooks/{webhook_id}/test")
async def test_webhook(
    webhook_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a test event to a webhook."""
    result = await db.execute(
        select(WebhookConfig).where(
            WebhookConfig.id == webhook_id, WebhookConfig.user_id == current_user.id
        )
    )
    webhook = result.scalar_one_or_none()
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    success = await webhook_service.dispatch(
        provider=WebhookProvider(webhook.provider),
        webhook_url=webhook.webhook_url,
        event_type="test",
        data={
            "message": f"Test webhook from FlaskAI — {current_user.display_name}",
            "timestamp": datetime.utcnow().isoformat(),
        },
    )

    return {"success": success, "provider": webhook.provider}


# ─── Calendar Integration (iCal export) ────────────────────

@router.get("/calendar/upcoming-calls")
async def upcoming_calls_ical(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Return upcoming / recent calls in a structured format
    that can be imported into calendar apps.
    """
    from app.models.models import Call, CallParticipant

    result = await db.execute(
        select(Call)
        .join(CallParticipant)
        .where(CallParticipant.user_id == current_user.id)
        .order_by(Call.started_at.desc())
        .limit(20)
    )
    calls = result.scalars().all()

    events = []
    for c in calls:
        events.append({
            "id": str(c.id),
            "title": f"FlaskAI {c.call_type.title()} Call",
            "start": c.started_at.isoformat() if c.started_at else None,
            "end": c.ended_at.isoformat() if c.ended_at else None,
            "duration_seconds": c.duration_seconds,
            "status": c.status,
            "room_name": c.room_name,
        })

    return {"events": events, "total": len(events)}
