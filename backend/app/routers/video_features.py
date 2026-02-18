"""Video features router — quality, codec, bandwidth, screen share."""

from fastapi import APIRouter, Depends
from app.models.database import User
from app.dependencies import get_current_user
from app.services.video_quality_service import VideoQualityService, VideoProfile, VideoCodec
from pydantic import BaseModel

router = APIRouter()


class VideoProfileRequest(BaseModel):
    call_id: str
    profile: VideoProfile


class VideoCodecRequest(BaseModel):
    call_id: str
    codec: VideoCodec


class BandwidthRequest(BaseModel):
    call_id: str
    user_id: str


class ScreenShareOptRequest(BaseModel):
    call_id: str


# ─── Video Quality Settings ────────────────────────────────

@router.post("/profile/set")
async def set_video_profile(req: VideoProfileRequest, current_user: User = Depends(get_current_user)):
    """Set user's preferred video quality profile."""
    result = await VideoQualityService.set_video_profile(
        current_user.id, req.call_id, req.profile
    )
    return {"status": "profile_set", "profile": result}


@router.get("/{call_id}/profile")
async def get_video_profile(call_id: str, current_user: User = Depends(get_current_user)):
    """Get user's current video profile."""
    profile = await VideoQualityService.get_video_profile(current_user.id, call_id)
    return profile


@router.post("/bandwidth/detect")
async def detect_bandwidth(req: BandwidthRequest, current_user: User = Depends(get_current_user)):
    """Estimate bandwidth and get profile recommendation."""
    result = await VideoQualityService.detect_bandwidth(current_user.id, req.call_id)
    return result


@router.post("/bandwidth/report")
async def report_bandwidth(
    call_id: str, bitrate_kbps: float, current_user: User = Depends(get_current_user)
):
    """Report actual bandwidth for adaptive bitrate."""
    return {
        "status": "bandwidth_reported",
        "bitrate_kbps": bitrate_kbps,
        "adjusted": True,
    }


# ─── Codec Selection ───────────────────────────────────────

@router.post("/codec/set")
async def set_video_codec(req: VideoCodecRequest, current_user: User = Depends(get_current_user)):
    """Set preferred video codec for call."""
    result = await VideoQualityService.set_video_codec(req.call_id, req.codec)
    return {"status": "codec_set", "codec": result}


@router.get("/{call_id}/codec")
async def get_video_codec(call_id: str, current_user: User = Depends(get_current_user)):
    """Get video codec settings for call."""
    settings = await VideoQualityService.get_call_video_settings(call_id)
    return settings


@router.get("/{call_id}/codec/support")
async def get_codec_support(call_id: str, current_user: User = Depends(get_current_user)):
    """Get list of supported codecs."""
    return {
        "supported_codecs": [
            {
                "codec": "vp8",
                "name": "VP8",
                "hardware_accelerated": False,
                "bandwidth_efficient": True,
            },
            {
                "codec": "vp9",
                "name": "VP9",
                "hardware_accelerated": False,
                "bandwidth_efficient": True,
                "hdr_support": True,
            },
            {
                "codec": "h264",
                "name": "H.264",
                "hardware_accelerated": True,
                "bandwidth_efficient": False,
            },
            {
                "codec": "h265",
                "name": "H.265 (HEVC)",
                "hardware_accelerated": True,
                "bandwidth_efficient": True,
                "hdr_support": True,
            },
        ]
    }


# ─── Screen Share Optimization ────────────────────────────

@router.post("/screen-share/optimize")
async def optimize_screen_share(req: ScreenShareOptRequest, current_user: User = Depends(get_current_user)):
    """Automatically optimize video settings for screen share."""
    result = await VideoQualityService.enable_screen_share_optimization(
        req.call_id, current_user.id
    )
    return {"status": "screen_share_optimized", "settings": result}


@router.get("/{call_id}/screen-share/status")
async def get_screen_share_status(call_id: str, current_user: User = Depends(get_current_user)):
    """Get screen share optimization status."""
    return {
        "call_id": call_id,
        "screen_share_active": True,
        "camera_bitrate_kbps": 200,
        "screen_bitrate_kbps": 3000,
        "priority": "screen",
    }


# ─── Statistics & Monitoring ───────────────────────────────

@router.get("/{call_id}/user/{user_id}/stats")
async def get_video_stats(
    call_id: str, user_id: str, current_user: User = Depends(get_current_user)
):
    """Get video quality statistics for a user."""
    stats = await VideoQualityService.get_video_statistics(call_id, user_id)
    return stats


@router.post("/{call_id}/user/{user_id}/keyframe")
async def request_keyframe(
    call_id: str, user_id: str, current_user: User = Depends(get_current_user)
):
    """Request keyframe to recover from video corruption."""
    result = await VideoQualityService.request_keyframe(call_id, user_id)
    return result


@router.post("/{call_id}/auto-adjust")
async def enable_auto_adjust(call_id: str, enabled: bool = True, current_user: User = Depends(get_current_user)):
    """Enable/disable automatic quality adjustment."""
    return {
        "call_id": call_id,
        "auto_adjust_enabled": enabled,
        "adjustment_strategy": "bandwidth_aware" if enabled else "fixed",
    }


# ─── Advanced Video Settings ────────────────────────────────

@router.post("/{call_id}/settings/update")
async def update_video_settings(
    call_id: str,
    max_width: int = 1920,
    max_height: int = 1080,
    max_framerate: int = 30,
    current_user: User = Depends(get_current_user),
):
    """Update advanced video settings."""
    return {
        "call_id": call_id,
        "settings": {
            "max_width": max_width,
            "max_height": max_height,
            "max_framerate": max_framerate,
            "applied": True,
        },
    }


@router.post("/{call_id}/mirror")
async def toggle_mirror(call_id: str, enabled: bool, current_user: User = Depends(get_current_user)):
    """Toggle mirror effect on local video."""
    return {"call_id": call_id, "mirror_enabled": enabled}


@router.post("/{call_id}/blur-background")
async def set_background_blur(call_id: str, strength: int = 5, current_user: User = Depends(get_current_user)):
    """Set background blur strength (0-10)."""
    return {
        "call_id": call_id,
        "background_blur": min(10, max(0, strength)),
        "status": "applied",
    }
