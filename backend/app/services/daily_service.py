"""Daily.co WebRTC room management."""

import httpx

from app.config import get_settings


class DailyService:
    """Create and manage Daily.co rooms and tokens."""

    async def create_room(
        self,
        name: str | None = None,
        max_participants: int = 2,
        enable_recording: bool = False,
    ) -> dict:
        """Create a new Daily.co room."""
        settings = get_settings()

        headers = {
            "Authorization": f"Bearer {settings.daily_api_key}",
            "Content-Type": "application/json",
        }

        payload: dict = {
            "properties": {
                "max_participants": max_participants,
                "enable_chat": True,
                "enable_screenshare": True,
                "enable_recording": "cloud" if enable_recording else None,
                "exp": None,  # No expiry for MVP
            }
        }

        if name:
            payload["name"] = name

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{settings.daily_api_url}/rooms",
                headers=headers,
                json=payload,
            )
            resp.raise_for_status()
            return resp.json()

    async def create_meeting_token(
        self,
        room_name: str,
        is_owner: bool = False,
    ) -> str:
        """Create a meeting token for a room."""
        settings = get_settings()

        headers = {
            "Authorization": f"Bearer {settings.daily_api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "properties": {
                "room_name": room_name,
                "is_owner": is_owner,
            }
        }

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{settings.daily_api_url}/meeting-tokens",
                headers=headers,
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            return data["token"]

    async def get_meeting_token(
        self,
        room_name: str,
        user_id: str,
        is_owner: bool = False,
    ) -> str:
        """Create a meeting token for a specific user."""
        settings = get_settings()

        headers = {
            "Authorization": f"Bearer {settings.daily_api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "properties": {
                "room_name": room_name,
                "is_owner": is_owner,
                "user_id": user_id,
                "user_name": f"user_{user_id[:8]}",
            }
        }

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{settings.daily_api_url}/meeting-tokens",
                headers=headers,
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            return data["token"]

    async def delete_room(self, room_name: str) -> None:
        """Delete a Daily.co room."""
        settings = get_settings()

        headers = {"Authorization": f"Bearer {settings.daily_api_key}"}

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.delete(
                f"{settings.daily_api_url}/rooms/{room_name}",
                headers=headers,
            )
            resp.raise_for_status()


# Singleton
daily_service = DailyService()
