"""Voice cloning & profile management."""

from fastapi import APIRouter, Depends, HTTPException, UploadFile

from app.dependencies import get_current_user
from app.models.models import User
from app.services.voice_service import voice_service

router = APIRouter()


@router.post("/clone")
async def clone_voice(
    audio_file: UploadFile,
    current_user: User = Depends(get_current_user),
):
    """Upload a voice sample (≥60s) and create a cloned voice profile."""
    if not audio_file.content_type or "audio" not in audio_file.content_type:
        raise HTTPException(status_code=400, detail="File must be an audio file")

    audio_bytes = await audio_file.read()
    if len(audio_bytes) < 1000:
        raise HTTPException(status_code=400, detail="Audio sample too short")

    try:
        voice_id = await voice_service.clone_voice(
            user_id=str(current_user.id),
            audio_data=audio_bytes,
            file_name=audio_file.filename or "sample.wav",
        )
        return {
            "voice_id": voice_id,
            "status": "active",
            "user_id": str(current_user.id),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/profile")
async def get_my_voice_profile(
    current_user: User = Depends(get_current_user),
):
    """Get voice profile for the current user."""
    profile = await voice_service.get_profile(str(current_user.id))
    if not profile:
        raise HTTPException(status_code=404, detail="Voice profile not found")
    return profile


@router.get("/profiles/{user_id}")
async def get_voice_profile(user_id: str):
    """Get voice profile for a specific user."""
    profile = await voice_service.get_profile(user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Voice profile not found")
    return profile


@router.delete("/profile")
async def delete_voice_profile(
    current_user: User = Depends(get_current_user),
):
    """Delete voice profile for the current user."""
    try:
        await voice_service.delete_profile(str(current_user.id))
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
