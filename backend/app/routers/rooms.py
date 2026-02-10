"""Room management — create rooms and issue tokens via LiveKit."""

import uuid

from fastapi import APIRouter
from pydantic import BaseModel

from app.services.livekit_service import livekit_service

router = APIRouter()


class CreateRoomRequest(BaseModel):
    name: str | None = None
    max_participants: int = 2
    enable_recording: bool = False


class CreateRoomResponse(BaseModel):
    room_name: str
    room_url: str
    token: str


@router.post("/create", response_model=CreateRoomResponse)
async def create_room(req: CreateRoomRequest):
    """Create a LiveKit room and return a join token."""
    room_name = req.name or f"room-{uuid.uuid4().hex[:12]}"

    token = livekit_service.create_token(
        room_name=room_name,
        participant_identity=f"host-{uuid.uuid4().hex[:8]}",
        participant_name="Host",
    )

    return CreateRoomResponse(
        room_name=room_name,
        room_url=livekit_service.get_ws_url(),
        token=token,
    )


@router.post("/{room_name}/token")
async def get_room_token(room_name: str):
    """Get a meeting token for an existing room."""
    token = livekit_service.create_token(
        room_name=room_name,
        participant_identity=f"user-{uuid.uuid4().hex[:8]}",
    )
    return {"token": token}
