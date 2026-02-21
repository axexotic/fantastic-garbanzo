"""Video quality management — bandwidth, resolution, codec selection."""

import json
from typing import Dict, Literal
from app.services.redis_service import redis_service

VideoProfile = Literal["low", "medium", "high", "hd", "fullhd", "4k"]
VideoCodec = Literal["vp8", "vp9", "h264", "h265"]


class VideoQualityService:
    """Manage video quality settings and auto-bandwidth negotiation."""

    @staticmethod
    async def set_video_profile(
        user_id: str, call_id: str, profile: VideoProfile
    ) -> Dict:
        """Set user's preferred video quality profile."""
        profiles = {
            "low": {"width": 320, "height": 240, "framerate": 15, "bitrate_kbps": 300},
            "medium": {"width": 640, "height": 480, "framerate": 24, "bitrate_kbps": 800},
            "high": {"width": 1280, "height": 720, "framerate": 30, "bitrate_kbps": 2500},
            "hd": {"width": 1920, "height": 1080, "framerate": 30, "bitrate_kbps": 5000},
            "fullhd": {"width": 1920, "height": 1080, "framerate": 60, "bitrate_kbps": 8000},
            "4k": {"width": 3840, "height": 2160, "framerate": 30, "bitrate_kbps": 15000},
        }
        
        if profile not in profiles:
            raise ValueError(f"Invalid profile: {profile}")
        
        key = f"call:{call_id}:user:{user_id}:video_profile"
        await redis_service.set(
            key, json.dumps({"profile": profile, **profiles[profile]}), 3600
        )
        return profiles[profile]

    @staticmethod
    async def get_video_profile(user_id: str, call_id: str) -> Dict:
        """Get user's current video quality settings."""
        key = f"call:{call_id}:user:{user_id}:video_profile"
        data = await redis_service.get(key)
        if not data:
            return {
                "profile": "medium",
                "width": 640,
                "height": 480,
                "framerate": 24,
                "bitrate_kbps": 800,
            }
        return json.loads(data)

    @staticmethod
    async def detect_bandwidth(user_id: str, call_id: str) -> Dict:
        """Estimate available bandwidth and recommend profile."""
        # In production, this would measure actual bandwidth
        # For now, return default recommendations
        key = f"call:{call_id}:user:{user_id}:bandwidth_history"
        
        recommendations = {
            "estimated_mbps": 5.0,
            "recommended_profile": "high",
            "min_bitrate_kbps": 500,
            "max_bitrate_kbps": 5000,
            "trend": "stable",
            "can_upgrade": True,
        }
        
        await redis_service.set(key, json.dumps(recommendations), 60)
        return recommendations

    @staticmethod
    async def set_video_codec(call_id: str, codec: VideoCodec) -> Dict:
        """Set preferred video codec for call."""
        codecs_info = {
            "vp8": {"name": "VP8", "hardware": False, "cost": 0.8},
            "vp9": {"name": "VP9", "hardware": False, "cost": 0.6, "hdr": True},
            "h264": {"name": "H.264", "hardware": True, "cost": 0.9},
            "h265": {"name": "H.265 (HEVC)", "hardware": True, "cost": 0.5, "hdr": True},
        }
        
        if codec not in codecs_info:
            raise ValueError(f"Invalid codec: {codec}")
        
        key = f"call:{call_id}:video_codec"
        await redis_service.set(
            key, json.dumps({"codec": codec, **codecs_info[codec]}), 3600
        )
        return codecs_info[codec]

    @staticmethod
    async def get_call_video_settings(call_id: str) -> Dict:
        """Get all video settings for a call."""
        codec_key = f"call:{call_id}:video_codec"
        codec_data = await redis_service.get(codec_key)
        
        return {
            "codec": json.loads(codec_data) if codec_data else {"codec": "vp8"},
            "auto_adjust": True,
            "max_participants_hd": 4,
            "screen_share_priority": True,
        }

    @staticmethod
    async def enable_screen_share_optimization(call_id: str, user_id: str) -> Dict:
        """Optimize video settings for screen share priority."""
        key = f"call:{call_id}:screen_share_opt"
        opt_settings = {
            "enabled": True,
            "camera_profile": "low",
            "screen_bitrate_kbps": 3000,
            "camera_bitrate_kbps": 200,
            "screen_framerate": 30,
            "camera_framerate": 15,
        }
        
        await redis_service.set(key, json.dumps(opt_settings), 3600)
        return opt_settings

    @staticmethod
    async def get_video_statistics(call_id: str, user_id: str) -> Dict:
        """Get video quality statistics for user."""
        return {
            "current_bitrate_kbps": 2400,
            "sent_bitrate_kbps": 2350,
            "received_bitrate_kbps": 2400,
            "resolution": "1280x720",
            "framerate": 30,
            "packet_loss_percent": 0.1,
            "jitter_ms": 5,
            "rtt_ms": 25,
            "codec": "vp8",
            "video_quality_score": 8.5,
        }

    @staticmethod
    async def request_keyframe(call_id: str, user_id: str) -> Dict:
        """Request keyframe to recover from video corruption."""
        key = f"call:{call_id}:user:{user_id}:keyframe_request"
        await redis_service.set(key, "requested", 10)
        return {"status": "keyframe_requested", "timestamp": int(__import__("time").time())}
