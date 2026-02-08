"""Voice cloning & profile management."""

from fastapi import APIRouter, HTTPException, UploadFile

from app.services.voice_service import voice_service

router = APIRouter()


@router.post("/clone")
async def clone_voice(user_id: str, audio_file: UploadFile):
    """Upload a voice sample (≥60s) and create a cloned voice profile."""
    if not audio_file.content_type or "audio" not in audio_file.content_type:
        raise HTTPException(status_code=400, detail="File must be an audio file")

    audio_bytes = await audio_file.read()
    if len(audio_bytes) < 1000:
        raise HTTPException(status_code=400, detail="Audio sample too short")

    try:
        voice_id = await voice_service.clone_voice(
            user_id=user_id,
            audio_data=audio_bytes,
            file_name=audio_file.filename or "sample.wav",
        )
        return {"voice_id": voice_id, "status": "cloned"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/profiles/{user_id}")
async def get_voice_profile(user_id: str):
    """Get voice profile for a user."""
    profile = await voice_service.get_profile(user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Voice profile not found")
    return profile
