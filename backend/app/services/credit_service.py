"""Credit service — balance checks, deductions, per-operation costs."""

import logging
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import CreditBalance, CreditTransaction

logger = logging.getLogger(__name__)


# ─── Per-operation costs (in cents) ─────────────────────────
# These are approximate costs based on API provider pricing + margin.
# Adjust as needed to stay profitable.

COST_STT_PER_MINUTE = 1  # ~$0.01 per minute of audio (Deepgram)
COST_TRANSLATION_PER_REQUEST = 1  # ~$0.01 per translation chunk (GPT-4/Claude)
COST_TTS_PER_REQUEST = 2  # ~$0.02 per TTS synthesis (ElevenLabs)
COST_VOICE_CLONE = 50  # $0.50 one-time voice clone
COST_PIPELINE_PER_CHUNK = 4  # combined STT+translate+TTS for one audio chunk

# Minimum balance required to start a pipeline operation
MIN_BALANCE_CENTS = 1  # $0.01 — effectively "any credits at all"


class CreditService:
    """Manages credit balance checks and deductions."""

    async def get_balance(self, user_id, db: AsyncSession) -> int:
        """Return balance in cents. 0 if no record."""
        result = await db.execute(
            select(CreditBalance.balance_cents).where(
                CreditBalance.user_id == user_id
            )
        )
        bal = result.scalar_one_or_none()
        return bal or 0

    async def has_sufficient_credits(
        self, user_id, db: AsyncSession, required_cents: int = MIN_BALANCE_CENTS
    ) -> bool:
        """Check if user has enough credits."""
        balance = await self.get_balance(user_id, db)
        return balance >= required_cents

    async def deduct(
        self,
        user_id,
        db: AsyncSession,
        amount_cents: int,
        transaction_type: str,
        description: str = "",
        metadata: dict | None = None,
    ) -> bool:
        """
        Deduct credits from user.
        Returns True if successful, False if insufficient balance.
        """
        result = await db.execute(
            select(CreditBalance).where(CreditBalance.user_id == user_id)
        )
        bal = result.scalar_one_or_none()

        if not bal or bal.balance_cents < amount_cents:
            return False

        bal.balance_cents -= amount_cents
        bal.total_used_cents += amount_cents
        bal.updated_at = datetime.utcnow()

        txn = CreditTransaction(
            credit_balance_id=bal.id,
            amount_cents=-amount_cents,  # negative = usage
            transaction_type=transaction_type,
            description=description,
            metadata_json=metadata or {},
        )
        db.add(txn)
        await db.commit()

        logger.info(
            "Deducted %d cents (type=%s) from user %s. Remaining: %d",
            amount_cents,
            transaction_type,
            user_id,
            bal.balance_cents,
        )
        return True

    async def deduct_pipeline(
        self,
        user_id,
        db: AsyncSession,
        source_lang: str = "",
        target_lang: str = "",
    ) -> bool:
        """
        Deduct credits for one full pipeline chunk (STT + translate + TTS).
        Returns True if successful, False if insufficient.
        """
        return await self.deduct(
            user_id=user_id,
            db=db,
            amount_cents=COST_PIPELINE_PER_CHUNK,
            transaction_type="pipeline",
            description=f"Translation {source_lang}→{target_lang}",
            metadata={"source_lang": source_lang, "target_lang": target_lang},
        )

    async def deduct_voice_clone(self, user_id, db: AsyncSession) -> bool:
        """Deduct credits for voice cloning."""
        return await self.deduct(
            user_id=user_id,
            db=db,
            amount_cents=COST_VOICE_CLONE,
            transaction_type="voice_clone",
            description="Voice profile cloning",
        )

    async def has_chat_plan(self, user_id, db: AsyncSession) -> bool:
        """Check if user has purchased the $15 lifetime chat plan."""
        result = await db.execute(
            select(CreditBalance.chat_plan_purchased).where(
                CreditBalance.user_id == user_id
            )
        )
        val = result.scalar_one_or_none()
        return bool(val)


# Singleton
credit_service = CreditService()
