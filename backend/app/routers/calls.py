"""Call history & management endpoints."""

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class CallLog(BaseModel):
    call_id: str
    room_name: str
    participants: list[str]
    duration_seconds: float
    languages: list[str]
    created_at: str


@router.get("/")
async def list_calls():
    """List recent calls (placeholder — wire to PostgreSQL)."""
    return {"calls": [], "total": 0}


@router.get("/{call_id}")
async def get_call(call_id: str):
    """Get call details by ID."""
    return {"call_id": call_id, "status": "not_found"}
