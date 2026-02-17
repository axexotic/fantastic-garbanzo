"""Advanced call features — hold, transfer, waiting, lock, recording, speaking time, etc."""

import asyncio
import uuid
from datetime import datetime
from typing import Optional

from app.services.redis_service import redis_service


class CallFeaturesService:
    """Manages advanced call features via Redis for real-time state."""

    # ─── Call Hold / Resume ──────────────────────────────────

    async def hold_call(self, call_id: str, user_id: str) -> bool:
        """Put a call on hold for a specific user."""
        key = f"call:{call_id}:hold:{user_id}"
        await redis_service.set(key, datetime.utcnow().isoformat(), ex=3600)
        return True

    async def resume_call(self, call_id: str, user_id: str) -> bool:
        """Resume a held call."""
        key = f"call:{call_id}:hold:{user_id}"
        await redis_service.delete(key)
        return True

    async def is_on_hold(self, call_id: str, user_id: str) -> bool:
        key = f"call:{call_id}:hold:{user_id}"
        return await redis_service.get(key) is not None

    # ─── Call Transfer ───────────────────────────────────────

    async def initiate_transfer(
        self, call_id: str, from_user: str, to_user: str, chat_id: str
    ) -> dict:
        """Create a transfer request."""
        transfer_id = str(uuid.uuid4())
        key = f"call:transfer:{transfer_id}"
        data = {
            "call_id": call_id,
            "from_user": from_user,
            "to_user": to_user,
            "chat_id": chat_id,
            "status": "pending",
            "created_at": datetime.utcnow().isoformat(),
        }
        await redis_service.set(key, str(data), ex=120)
        return {"transfer_id": transfer_id, **data}

    # ─── Call Waiting ────────────────────────────────────────

    async def add_to_waiting(self, user_id: str, call_id: str, call_data: dict) -> None:
        """Add a call to the user's waiting queue."""
        key = f"user:{user_id}:waiting_calls"
        await redis_service.set(
            f"{key}:{call_id}", str(call_data), ex=120
        )

    async def get_waiting_calls(self, user_id: str) -> list:
        """Get all waiting calls for a user."""
        # Simplified - in production would scan keys
        return []

    # ─── Call Lock ───────────────────────────────────────────

    async def lock_call(self, call_id: str, password: str) -> bool:
        """Lock a call with a password."""
        key = f"call:{call_id}:lock"
        await redis_service.set(key, password, ex=86400)
        return True

    async def unlock_call(self, call_id: str) -> bool:
        """Remove call lock."""
        key = f"call:{call_id}:lock"
        await redis_service.delete(key)
        return True

    async def verify_call_lock(self, call_id: str, password: str) -> bool:
        """Verify call lock password."""
        key = f"call:{call_id}:lock"
        stored = await redis_service.get(key)
        if stored is None:
            return True  # Not locked
        return stored == password

    async def is_call_locked(self, call_id: str) -> bool:
        key = f"call:{call_id}:lock"
        return await redis_service.get(key) is not None

    # ─── Speaking Time Tracking ──────────────────────────────

    async def start_speaking(self, call_id: str, user_id: str) -> None:
        """Record when a user starts speaking."""
        key = f"call:{call_id}:speaking:{user_id}:start"
        await redis_service.set(key, datetime.utcnow().isoformat(), ex=86400)

    async def stop_speaking(self, call_id: str, user_id: str) -> float:
        """Record when a user stops speaking, return duration."""
        start_key = f"call:{call_id}:speaking:{user_id}:start"
        total_key = f"call:{call_id}:speaking:{user_id}:total"

        start_time = await redis_service.get(start_key)
        if not start_time:
            return 0

        start = datetime.fromisoformat(start_time)
        duration = (datetime.utcnow() - start).total_seconds()

        current_total = await redis_service.get(total_key)
        total = float(current_total or 0) + duration
        await redis_service.set(total_key, str(total), ex=86400)
        await redis_service.delete(start_key)

        return total

    async def get_speaking_time(self, call_id: str, user_id: str) -> float:
        """Get total speaking time for a user in a call."""
        total_key = f"call:{call_id}:speaking:{user_id}:total"
        val = await redis_service.get(total_key)
        return float(val or 0)

    # ─── Raise Hand ──────────────────────────────────────────

    async def raise_hand(self, call_id: str, user_id: str) -> bool:
        key = f"call:{call_id}:hand:{user_id}"
        await redis_service.set(key, "1", ex=3600)
        return True

    async def lower_hand(self, call_id: str, user_id: str) -> bool:
        key = f"call:{call_id}:hand:{user_id}"
        await redis_service.delete(key)
        return True

    # ─── Emoji Reactions ─────────────────────────────────────

    async def send_reaction(
        self, call_id: str, user_id: str, emoji: str
    ) -> dict:
        return {
            "call_id": call_id,
            "user_id": user_id,
            "emoji": emoji,
            "timestamp": datetime.utcnow().isoformat(),
        }

    # ─── Polls ───────────────────────────────────────────────

    async def create_poll(
        self, call_id: str, creator_id: str, question: str, options: list[str]
    ) -> dict:
        poll_id = str(uuid.uuid4())[:8]
        poll = {
            "poll_id": poll_id,
            "call_id": call_id,
            "creator_id": creator_id,
            "question": question,
            "options": {opt: [] for opt in options},
            "created_at": datetime.utcnow().isoformat(),
            "is_active": True,
        }
        key = f"call:{call_id}:poll:{poll_id}"
        import json
        await redis_service.set(key, json.dumps(poll), ex=86400)
        return poll

    async def vote_poll(
        self, call_id: str, poll_id: str, user_id: str, option: str
    ) -> dict:
        import json
        key = f"call:{call_id}:poll:{poll_id}"
        data = await redis_service.get(key)
        if not data:
            return {"error": "Poll not found"}
        poll = json.loads(data)
        # Remove previous vote
        for opt, voters in poll["options"].items():
            if user_id in voters:
                voters.remove(user_id)
        # Add new vote
        if option in poll["options"]:
            poll["options"][option].append(user_id)
        await redis_service.set(key, json.dumps(poll), ex=86400)
        return poll

    # ─── Engagement Score ────────────────────────────────────

    async def calculate_engagement(self, call_id: str, user_id: str) -> dict:
        """Calculate engagement score based on speaking time and reactions."""
        speaking = await self.get_speaking_time(call_id, user_id)
        return {
            "user_id": user_id,
            "speaking_seconds": speaking,
            "engagement_score": min(100, int(speaking / 60 * 20)),
        }


# Singleton
call_features = CallFeaturesService()
