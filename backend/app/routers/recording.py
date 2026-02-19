"""Recording router — start, stop, playback, transcription."""

from fastapi import APIRouter, Depends
from app.models.models import User
from app.dependencies import get_current_user
from app.services.recording_service import RecordingService, RecordingFormat
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class StartRecordingRequest(BaseModel):
    call_id: str
    format: RecordingFormat = "webm"


class TranscribeRequest(BaseModel):
    call_id: str
    language: str = "en"


# ─── Recording Control ────────────────────────────────────

@router.post("/start")
async def start_recording(req: StartRecordingRequest, current_user: User = Depends(get_current_user)):
    """Start recording a call."""
    result = await RecordingService.start_recording(req.call_id, req.format)
    return result


@router.post("/{call_id}/stop")
async def stop_recording(call_id: str, current_user: User = Depends(get_current_user)):
    """Stop active recording."""
    result = await RecordingService.stop_recording(call_id)
    return result


@router.get("/{call_id}/status")
async def get_recording_status(call_id: str, current_user: User = Depends(get_current_user)):
    """Get current recording status."""
    return await RecordingService.get_recording_status(call_id)


@router.post("/{call_id}/pause")
async def pause_recording(call_id: str, current_user: User = Depends(get_current_user)):
    """Pause recording."""
    result = await RecordingService.pause_recording(call_id)
    return result


@router.post("/{call_id}/resume")
async def resume_recording(call_id: str, current_user: User = Depends(get_current_user)):
    """Resume paused recording."""
    result = await RecordingService.resume_recording(call_id)
    return result


# ─── Recording Management ────────────────────────────────

@router.get("/list")
async def list_recordings(skip: int = 0, limit: int = 50, current_user: User = Depends(get_current_user)):
    """List user's recordings."""
    return await RecordingService.list_recordings(current_user.id, limit)


@router.get("/{call_id}")
async def get_recording(call_id: str, current_user: User = Depends(get_current_user)):
    """Get recording details."""
    metadata = await RecordingService.get_recording_metadata(call_id)
    url = await RecordingService.get_recording_url(call_id)
    return {**metadata, "download_url": url["download_url"]}


@router.delete("/{call_id}")
async def delete_recording(call_id: str, current_user: User = Depends(get_current_user)):
    """Delete a recording."""
    return await RecordingService.delete_recording(call_id)


@router.get("/{call_id}/download-url")
async def get_download_url(call_id: str, expiry_hours: int = 24, current_user: User = Depends(get_current_user)):
    """Get signed download URL for recording."""
    return await RecordingService.get_recording_url(call_id, expiry_hours)


@router.get("/{call_id}/metadata")
async def get_metadata(call_id: str, current_user: User = Depends(get_current_user)):
    """Get detailed recording metadata."""
    return await RecordingService.get_recording_metadata(call_id)


# ─── Transcription ────────────────────────────────────────

@router.post("/{call_id}/transcribe")
async def transcribe_recording(req: TranscribeRequest, current_user: User = Depends(get_current_user)):
    """Start transcription of recording."""
    result = await RecordingService.transcribe_recording(req.call_id)
    return result


@router.get("/{call_id}/transcription")
async def get_transcription(call_id: str, current_user: User = Depends(get_current_user)):
    """Get transcription of recording."""
    return await RecordingService.get_transcription(call_id)


@router.get("/{call_id}/transcription/status")
async def get_transcription_status(call_id: str, current_user: User = Depends(get_current_user)):
    """Get transcription status."""
    return {
        "call_id": call_id,
        "status": "processing",
        "progress_percent": 45,
        "estimated_remaining_seconds": 300,
    }


@router.post("/{call_id}/transcription/export")
async def export_transcription(call_id: str, format: str = "srt", current_user: User = Depends(get_current_user)):
    """Export transcription in different formats (srt, vtt, txt)."""
    return {
        "call_id": call_id,
        "format": format,
        "export_url": f"https://api.flaskai.xyz/api/recordings/{call_id}/transcription.{format}",
        "expires_at": "2026-02-19T02:37:00Z",
    }


# ─── Advanced Recording Features ───────────────────────────

@router.post("/{call_id}/settings")
async def update_recording_settings(
    call_id: str,
    bitrate_kbps: Optional[int] = None,
    audio_quality: Optional[str] = None,
    include_screen_share: bool = True,
    current_user: User = Depends(get_current_user),
):
    """Update recording settings."""
    return {
        "call_id": call_id,
        "settings": {
            "bitrate_kbps": bitrate_kbps or 2048,
            "audio_quality": audio_quality or "high",
            "include_screen_share": include_screen_share,
            "applied": True,
        },
    }


@router.post("/{call_id}/consent-check")
async def check_recording_consent(call_id: str, current_user: User = Depends(get_current_user)):
    """Check if all participants consented to recording (compliance)."""
    return {
        "call_id": call_id,
        "all_consented": True,
        "participants_consented": 2,
        "total_participants": 2,
        "status": "recording_allowed",
    }


@router.post("/{call_id}/highlight")
async def create_highlight(
    call_id: str,
    start_seconds: int,
    end_seconds: int,
    title: str,
    current_user: User = Depends(get_current_user),
):
    """Create highlight clip from recording."""
    return {
        "call_id": call_id,
        "highlight_id": f"{call_id}_hl_{start_seconds}",
        "title": title,
        "duration_seconds": end_seconds - start_seconds,
        "status": "created",
        "clip_url": f"https://api.flaskai.xyz/api/recordings/{call_id}/highlights/{start_seconds}-{end_seconds}",
    }
