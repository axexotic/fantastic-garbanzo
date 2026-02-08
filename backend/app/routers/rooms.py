"""Daily.co room management — create / join / list rooms."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.daily_service import daily_service

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
    """Create a Daily.co room and return a join token."""
    try:
        room = await daily_service.create_room(
            name=req.name,
            max_participants=req.max_participants,
            enable_recording=req.enable_recording,
        )
        token = await daily_service.create_meeting_token(room["name"])
        return CreateRoomResponse(
            room_name=room["name"],
            room_url=room["url"],
            token=token,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{room_name}/token")
async def get_room_token(room_name: str):
    """Get a meeting token for an existing room."""
    try:
        token = await daily_service.create_meeting_token(room_name)
        return {"token": token}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
