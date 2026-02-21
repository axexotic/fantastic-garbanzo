"""User preferences router — privacy, chat settings, advanced, device defaults."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user
from app.models.database import get_db
from app.models.models import User, UserPreference

router = APIRouter()


# ─── Schemas ────────────────────────────────────────────────

class PreferencesResponse(BaseModel):
    # Privacy
    show_last_seen: str = "everyone"
    show_profile_photo: str = "everyone"
    show_read_receipts: bool = True
    two_factor_enabled: bool = False
    active_sessions_limit: int = 5
    # Chat
    chat_font_size: str = "medium"
    chat_wallpaper: str = "default"
    message_grouping: bool = True
    send_with_enter: bool = True
    auto_translate_messages: bool = True
    # Advanced
    auto_download_media: bool = True
    auto_download_max_size_mb: int = 10
    data_saver_mode: bool = False
    proxy_enabled: bool = False
    # Battery
    reduce_animations: bool = False
    power_saving_mode: bool = False
    auto_play_gifs: bool = True
    # Devices
    preferred_audio_input: str = ""
    preferred_audio_output: str = ""
    preferred_video_input: str = ""
    echo_cancellation: bool = True
    noise_suppression: bool = True
    auto_gain_control: bool = True
    # Voice setup flags
    voice_setup_seen: bool = False
    voice_setup_skipped: bool = False


class UpdatePreferencesRequest(BaseModel):
    show_last_seen: str | None = None
    show_profile_photo: str | None = None
    show_read_receipts: bool | None = None
    two_factor_enabled: bool | None = None
    active_sessions_limit: int | None = None
    chat_font_size: str | None = None
    chat_wallpaper: str | None = None
    message_grouping: bool | None = None
    send_with_enter: bool | None = None
    auto_translate_messages: bool | None = None
    auto_download_media: bool | None = None
    auto_download_max_size_mb: int | None = None
    data_saver_mode: bool | None = None
    proxy_enabled: bool | None = None
    reduce_animations: bool | None = None
    power_saving_mode: bool | None = None
    auto_play_gifs: bool | None = None
    preferred_audio_input: str | None = None
    preferred_audio_output: str | None = None
    preferred_video_input: str | None = None
    echo_cancellation: bool | None = None
    noise_suppression: bool | None = None
    auto_gain_control: bool | None = None
    voice_setup_seen: bool | None = None
    voice_setup_skipped: bool | None = None


def _pref_to_dict(pref: UserPreference) -> dict:
    return {
        "show_last_seen": pref.show_last_seen,
        "show_profile_photo": pref.show_profile_photo,
        "show_read_receipts": pref.show_read_receipts,
        "two_factor_enabled": pref.two_factor_enabled,
        "active_sessions_limit": pref.active_sessions_limit,
        "chat_font_size": pref.chat_font_size,
        "chat_wallpaper": pref.chat_wallpaper,
        "message_grouping": pref.message_grouping,
        "send_with_enter": pref.send_with_enter,
        "auto_translate_messages": pref.auto_translate_messages,
        "auto_download_media": pref.auto_download_media,
        "auto_download_max_size_mb": pref.auto_download_max_size_mb,
        "data_saver_mode": pref.data_saver_mode,
        "proxy_enabled": pref.proxy_enabled,
        "reduce_animations": pref.reduce_animations,
        "power_saving_mode": pref.power_saving_mode,
        "auto_play_gifs": pref.auto_play_gifs,
        "preferred_audio_input": pref.preferred_audio_input,
        "preferred_audio_output": pref.preferred_audio_output,
        "preferred_video_input": pref.preferred_video_input,
        "echo_cancellation": pref.echo_cancellation,
        "noise_suppression": pref.noise_suppression,
        "auto_gain_control": pref.auto_gain_control,
        "voice_setup_seen": pref.voice_setup_seen,
        "voice_setup_skipped": pref.voice_setup_skipped,
    }


async def _ensure_preferences(user_id, db: AsyncSession) -> UserPreference:
    result = await db.execute(
        select(UserPreference).where(UserPreference.user_id == user_id)
    )
    pref = result.scalar_one_or_none()
    if not pref:
        pref = UserPreference(user_id=user_id)
        db.add(pref)
        await db.commit()
        await db.refresh(pref)
    return pref


@router.get("/", response_model=PreferencesResponse)
async def get_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's preferences."""
    pref = await _ensure_preferences(current_user.id, db)
    return _pref_to_dict(pref)


@router.patch("/", response_model=PreferencesResponse)
async def update_preferences(
    req: UpdatePreferencesRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update preferences (partial)."""
    pref = await _ensure_preferences(current_user.id, db)

    updates = req.model_dump(exclude_none=True)
    for key, value in updates.items():
        if hasattr(pref, key):
            setattr(pref, key, value)

    await db.commit()
    await db.refresh(pref)
    return _pref_to_dict(pref)
