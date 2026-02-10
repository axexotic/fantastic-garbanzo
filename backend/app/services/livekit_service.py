"""LiveKit WebRTC room & token management.

LiveKit tokens are JWTs generated locally — no external API calls needed to
create rooms or issue tokens. The LiveKit server itself creates rooms
on-the-fly when the first participant connects with a valid token.
"""

import datetime

from livekit.api import AccessToken, VideoGrants

from app.config import get_settings


class LiveKitService:
    """Generate access tokens for LiveKit rooms."""

    def create_token(
        self,
        room_name: str,
        participant_identity: str,
        participant_name: str = "",
        can_publish: bool = True,
        can_subscribe: bool = True,
    ) -> str:
        """Create a LiveKit access token (JWT) for a participant.

        The room is created automatically by the LiveKit server when the
        first participant joins with a valid token that grants room-join.
        """
        settings = get_settings()

        grant = VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=can_publish,
            can_subscribe=can_subscribe,
        )

        token = (
            AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
            .with_identity(participant_identity)
            .with_name(participant_name or participant_identity)
            .with_grants(grant)
            .with_ttl(datetime.timedelta(hours=6))
        )

        return token.to_jwt()

    def get_ws_url(self) -> str:
        """Return the LiveKit WebSocket URL for clients to connect to."""
        settings = get_settings()
        return settings.livekit_url


# Singleton
livekit_service = LiveKitService()
