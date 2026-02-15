"""Payments router — Stripe subscriptions, checkout, webhooks."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.dependencies import get_current_user
from app.models.database import get_db
from app.models.models import Subscription, User
from app.services.stripe_service import stripe_service

router = APIRouter()


# ─── Schemas ────────────────────────────────────────────────

class SubscriptionResponse(BaseModel):
    plan: str
    status: str
    current_period_end: str | None
    cancel_at_period_end: bool


class CheckoutRequest(BaseModel):
    price_id: str | None = None  # Use default pro price if not provided


# ─── Endpoints ──────────────────────────────────────────────

@router.get("/subscription", response_model=SubscriptionResponse)
async def get_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's subscription status."""
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id)
    )
    sub = result.scalar_one_or_none()

    if not sub:
        return SubscriptionResponse(
            plan="free",
            status="active",
            current_period_end=None,
            cancel_at_period_end=False,
        )

    return SubscriptionResponse(
        plan=sub.plan,
        status=sub.status,
        current_period_end=sub.current_period_end.isoformat() if sub.current_period_end else None,
        cancel_at_period_end=sub.cancel_at_period_end,
    )


@router.post("/checkout")
async def create_checkout(
    body: CheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a Stripe Checkout session for upgrading to Pro."""
    settings = get_settings()

    # Get or create subscription record
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id)
    )
    sub = result.scalar_one_or_none()

    # Create Stripe customer if not existing
    customer_id = sub.stripe_customer_id if sub else None
    if not customer_id:
        customer_id = await stripe_service.create_customer(
            email=current_user.email,
            name=current_user.display_name,
            user_id=str(current_user.id),
        )
        if not customer_id:
            raise HTTPException(status_code=502, detail="Failed to create Stripe customer")

        if not sub:
            sub = Subscription(
                user_id=current_user.id,
                stripe_customer_id=customer_id,
                plan="free",
                status="active",
            )
            db.add(sub)
        else:
            sub.stripe_customer_id = customer_id
        await db.commit()

    price_id = body.price_id or settings.stripe_price_id_pro
    if not price_id:
        raise HTTPException(status_code=400, detail="No price_id available")

    checkout_url = await stripe_service.create_checkout_session(
        customer_id=customer_id,
        price_id=price_id,
        user_id=str(current_user.id),
    )
    if not checkout_url:
        raise HTTPException(status_code=502, detail="Failed to create checkout session")

    return {"checkout_url": checkout_url}


@router.post("/portal")
async def customer_portal(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Redirect user to Stripe Customer Portal for subscription management."""
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id)
    )
    sub = result.scalar_one_or_none()

    if not sub or not sub.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No active subscription found")

    portal_url = await stripe_service.create_portal_session(sub.stripe_customer_id)
    if not portal_url:
        raise HTTPException(status_code=502, detail="Failed to create portal session")

    return {"portal_url": portal_url}


@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Handle Stripe webhook events."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    event = stripe_service.verify_webhook(payload, sig_header)
    if not event:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    event_type = event.get("type", "")
    data = event.get("data", {}).get("object", {})

    if event_type == "checkout.session.completed":
        await _handle_checkout_completed(data, db)
    elif event_type == "customer.subscription.updated":
        await _handle_subscription_updated(data, db)
    elif event_type == "customer.subscription.deleted":
        await _handle_subscription_deleted(data, db)

    return {"received": True}


# ─── Webhook Handlers ──────────────────────────────────────

async def _handle_checkout_completed(data: dict, db: AsyncSession):
    """Handle successful checkout — activate subscription."""
    customer_id = data.get("customer")
    subscription_id = data.get("subscription")

    if not customer_id:
        return

    result = await db.execute(
        select(Subscription).where(Subscription.stripe_customer_id == customer_id)
    )
    sub = result.scalar_one_or_none()
    if sub:
        sub.stripe_subscription_id = subscription_id
        sub.plan = "pro"
        sub.status = "active"
        sub.updated_at = datetime.utcnow()
        await db.commit()


async def _handle_subscription_updated(data: dict, db: AsyncSession):
    """Handle subscription changes — plan/status updates."""
    sub_id = data.get("id")
    if not sub_id:
        return

    result = await db.execute(
        select(Subscription).where(Subscription.stripe_subscription_id == sub_id)
    )
    sub = result.scalar_one_or_none()
    if sub:
        sub.status = data.get("status", sub.status)
        sub.cancel_at_period_end = data.get("cancel_at_period_end", False)

        period_end = data.get("current_period_end")
        if period_end:
            sub.current_period_end = datetime.utcfromtimestamp(period_end)

        period_start = data.get("current_period_start")
        if period_start:
            sub.current_period_start = datetime.utcfromtimestamp(period_start)

        sub.updated_at = datetime.utcnow()
        await db.commit()


async def _handle_subscription_deleted(data: dict, db: AsyncSession):
    """Handle subscription cancellation — revert to free."""
    sub_id = data.get("id")
    if not sub_id:
        return

    result = await db.execute(
        select(Subscription).where(Subscription.stripe_subscription_id == sub_id)
    )
    sub = result.scalar_one_or_none()
    if sub:
        sub.plan = "free"
        sub.status = "canceled"
        sub.stripe_subscription_id = None
        sub.updated_at = datetime.utcnow()
        await db.commit()
