"""Payments router — $15 lifetime chat plan, voice credits, Stripe webhooks."""

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user
from app.models.database import get_db
from app.models.models import CreditBalance, CreditTransaction, User
from app.services.stripe_service import stripe_service

router = APIRouter()
logger = logging.getLogger(__name__)


# ─── Schemas ────────────────────────────────────────────────

class BalanceResponse(BaseModel):
    chat_plan_purchased: bool  # $15 lifetime chat
    balance_cents: int  # voice/video credits
    balance_display: str  # e.g. "$5.23"
    total_purchased_cents: int
    total_used_cents: int


class BuyCreditsRequest(BaseModel):
    amount_cents: int = Field(ge=100, description="Minimum $1.00 (100 cents)")


class TransactionResponse(BaseModel):
    id: str
    amount_cents: int
    transaction_type: str
    description: str
    created_at: str


class TransactionListResponse(BaseModel):
    transactions: list[TransactionResponse]
    total: int


# ─── Helper: ensure CreditBalance + Stripe customer ────────

async def _ensure_credit_balance(
    user: User, db: AsyncSession
) -> CreditBalance:
    """Get or create the user's CreditBalance record with Stripe customer."""
    result = await db.execute(
        select(CreditBalance).where(CreditBalance.user_id == user.id)
    )
    bal = result.scalar_one_or_none()

    customer_id = bal.stripe_customer_id if bal else None
    if not customer_id:
        customer_id = await stripe_service.create_customer(
            email=user.email,
            name=user.display_name,
            user_id=str(user.id),
        )
        if not customer_id:
            raise HTTPException(status_code=502, detail="Failed to create Stripe customer")

        if not bal:
            bal = CreditBalance(
                user_id=user.id,
                stripe_customer_id=customer_id,
            )
            db.add(bal)
        else:
            bal.stripe_customer_id = customer_id
        await db.commit()
        await db.refresh(bal)

    return bal


# ─── Endpoints ──────────────────────────────────────────────

@router.get("/balance", response_model=BalanceResponse)
async def get_balance(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the current user's payment status (chat plan + voice credits)."""
    result = await db.execute(
        select(CreditBalance).where(CreditBalance.user_id == current_user.id)
    )
    bal = result.scalar_one_or_none()

    if not bal:
        return BalanceResponse(
            chat_plan_purchased=False,
            balance_cents=0,
            balance_display="$0.00",
            total_purchased_cents=0,
            total_used_cents=0,
        )

    return BalanceResponse(
        chat_plan_purchased=bal.chat_plan_purchased,
        balance_cents=bal.balance_cents,
        balance_display=f"${bal.balance_cents / 100:.2f}",
        total_purchased_cents=bal.total_purchased_cents,
        total_used_cents=bal.total_used_cents,
    )


@router.post("/buy-chat-plan")
async def buy_chat_plan(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a Stripe Checkout for the $15 lifetime chat plan."""
    bal = await _ensure_credit_balance(current_user, db)

    if bal.chat_plan_purchased:
        raise HTTPException(status_code=400, detail="Chat plan already purchased")

    checkout_url = await stripe_service.create_chat_plan_checkout(
        customer_id=bal.stripe_customer_id,
        user_id=str(current_user.id),
    )
    if not checkout_url:
        raise HTTPException(status_code=502, detail="Failed to create checkout session")

    return {"checkout_url": checkout_url}


@router.post("/buy-credits")
async def buy_credits(
    body: BuyCreditsRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a Stripe Checkout to purchase voice/video credits (min $1)."""
    bal = await _ensure_credit_balance(current_user, db)

    checkout_url = await stripe_service.create_credit_checkout(
        customer_id=bal.stripe_customer_id,
        amount_cents=body.amount_cents,
        user_id=str(current_user.id),
    )
    if not checkout_url:
        raise HTTPException(status_code=502, detail="Failed to create checkout session")

    return {"checkout_url": checkout_url}


@router.get("/transactions", response_model=TransactionListResponse)
async def get_transactions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    """Get the user's credit transaction history."""
    result = await db.execute(
        select(CreditBalance.id).where(CreditBalance.user_id == current_user.id)
    )
    bal_id = result.scalar_one_or_none()

    if not bal_id:
        return TransactionListResponse(transactions=[], total=0)

    count_result = await db.execute(
        select(func.count()).where(CreditTransaction.credit_balance_id == bal_id)
    )
    total = count_result.scalar() or 0

    result = await db.execute(
        select(CreditTransaction)
        .where(CreditTransaction.credit_balance_id == bal_id)
        .order_by(CreditTransaction.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    txns = result.scalars().all()

    return TransactionListResponse(
        transactions=[
            TransactionResponse(
                id=str(t.id),
                amount_cents=t.amount_cents,
                transaction_type=t.transaction_type,
                description=t.description or "",
                created_at=t.created_at.isoformat(),
            )
            for t in txns
        ],
        total=total,
    )


@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Handle Stripe webhook events for both chat plan and credit purchases."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    event = stripe_service.verify_webhook(payload, sig_header)
    if not event:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    event_type = event.get("type", "")
    data = event.get("data", {}).get("object", {})

    if event_type == "checkout.session.completed":
        await _handle_checkout_completed(data, db)

    return {"received": True}


# ─── Webhook Handlers ──────────────────────────────────────

async def _handle_checkout_completed(data: dict, db: AsyncSession):
    """Route to chat plan or credit handler based on metadata."""
    metadata = data.get("metadata", {})
    purchase_type = metadata.get("purchase_type", "")

    if purchase_type == "chat_plan":
        await _handle_chat_plan_purchased(data, db)
    elif purchase_type == "credits":
        await _handle_credits_purchased(data, db)
    else:
        logger.warning("Unknown purchase_type in webhook: %s", purchase_type)


async def _handle_chat_plan_purchased(data: dict, db: AsyncSession):
    """Activate lifetime chat plan for the user."""
    customer_id = data.get("customer")
    payment_intent_id = data.get("payment_intent")

    if not customer_id:
        return

    result = await db.execute(
        select(CreditBalance).where(CreditBalance.stripe_customer_id == customer_id)
    )
    bal = result.scalar_one_or_none()
    if not bal:
        logger.error("No CreditBalance for Stripe customer %s", customer_id)
        return

    if bal.chat_plan_purchased:
        logger.info("Chat plan already active for customer %s, skipping", customer_id)
        return

    bal.chat_plan_purchased = True
    bal.updated_at = datetime.utcnow()

    txn = CreditTransaction(
        credit_balance_id=bal.id,
        amount_cents=-1500,  # $15 debit recorded for history
        transaction_type="chat_plan",
        description="Lifetime Chat Plan — $15",
        stripe_payment_intent_id=payment_intent_id,
    )
    db.add(txn)
    await db.commit()
    logger.info("Chat plan activated for customer %s", customer_id)


async def _handle_credits_purchased(data: dict, db: AsyncSession):
    """Add voice/video credits to user's balance."""
    customer_id = data.get("customer")
    metadata = data.get("metadata", {})
    credit_cents = int(metadata.get("credit_cents", 0))
    payment_intent_id = data.get("payment_intent")

    if not customer_id or credit_cents <= 0:
        logger.warning("Webhook missing customer or credit_cents: %s", data)
        return

    result = await db.execute(
        select(CreditBalance).where(CreditBalance.stripe_customer_id == customer_id)
    )
    bal = result.scalar_one_or_none()
    if not bal:
        logger.error("No CreditBalance for Stripe customer %s", customer_id)
        return

    # Idempotency check
    if payment_intent_id:
        dup = await db.execute(
            select(CreditTransaction).where(
                CreditTransaction.stripe_payment_intent_id == payment_intent_id
            )
        )
        if dup.scalar_one_or_none():
            logger.info("Duplicate webhook for payment_intent %s, skipping", payment_intent_id)
            return

    bal.balance_cents += credit_cents
    bal.total_purchased_cents += credit_cents
    bal.updated_at = datetime.utcnow()

    txn = CreditTransaction(
        credit_balance_id=bal.id,
        amount_cents=credit_cents,
        transaction_type="purchase",
        description=f"Purchased ${credit_cents / 100:.2f} in voice credits",
        stripe_payment_intent_id=payment_intent_id,
    )
    db.add(txn)
    await db.commit()
    logger.info("Added %d cents voice credits to customer %s", credit_cents, customer_id)
