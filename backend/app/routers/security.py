"""Security router — 2FA setup/verify, device management, E2E keys."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user
from app.models.database import get_db
from app.models.models import User
from app.services.security_service import security_service
from app.services.redis_service import redis_service

router = APIRouter()


# ─── Request Models ──────────────────────────────────────────

class Enable2FARequest(BaseModel):
    password: str  # Confirm with current password

class Verify2FARequest(BaseModel):
    code: str

class DeviceRegisterRequest(BaseModel):
    fingerprint: str
    name: str = "Unknown Device"
    browser: str = "Unknown"
    os: str = "Unknown"

class TrustDeviceRequest(BaseModel):
    device_id: str

class PublicKeyRequest(BaseModel):
    public_key: str

class StatusUpdateRequest(BaseModel):
    status: str  # online, busy, away, invisible


# ─── 2FA Endpoints ───────────────────────────────────────────

@router.post("/2fa/setup")
async def setup_2fa(
    current_user: User = Depends(get_current_user),
):
    """Generate a TOTP secret and return the setup URI."""
    secret = security_service.generate_totp_secret()

    # Store secret temporarily (user must verify before it's confirmed)
    import json
    key = f"user:{current_user.id}:2fa_pending"
    await redis_service.set(key, secret, ex=600)  # 10 min expiry

    uri = security_service.get_totp_uri(secret, current_user.email)
    backup_codes = security_service.generate_backup_codes()

    # Store backup codes
    backup_key = f"user:{current_user.id}:2fa_backup_codes"
    await redis_service.set(backup_key, json.dumps(backup_codes), ex=86400 * 365)

    return {
        "secret": secret,
        "totp_uri": uri,
        "backup_codes": backup_codes,
        "message": "Scan the QR code and enter the verification code to complete setup",
    }


@router.post("/2fa/verify")
async def verify_2fa(
    req: Verify2FARequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify TOTP code to confirm 2FA setup."""
    key = f"user:{current_user.id}:2fa_pending"
    secret = await redis_service.get(key)

    if not secret:
        raise HTTPException(400, "No pending 2FA setup. Please start setup first.")

    if not security_service.verify_totp(secret, req.code):
        raise HTTPException(400, "Invalid verification code")

    # Confirm 2FA
    confirmed_key = f"user:{current_user.id}:2fa_secret"
    await redis_service.set(confirmed_key, secret, ex=86400 * 365)
    await redis_service.delete(key)

    return {"enabled": True, "message": "2FA enabled successfully"}


@router.post("/2fa/validate")
async def validate_2fa(
    req: Verify2FARequest,
    current_user: User = Depends(get_current_user),
):
    """Validate a 2FA code during login."""
    import json
    secret_key = f"user:{current_user.id}:2fa_secret"
    secret = await redis_service.get(secret_key)

    if not secret:
        return {"valid": True, "2fa_required": False}

    if security_service.verify_totp(secret, req.code):
        return {"valid": True}

    # Check backup codes
    backup_key = f"user:{current_user.id}:2fa_backup_codes"
    backup_raw = await redis_service.get(backup_key)
    if backup_raw:
        codes = json.loads(backup_raw)
        if req.code.upper() in codes:
            codes.remove(req.code.upper())
            await redis_service.set(backup_key, json.dumps(codes), ex=86400 * 365)
            return {"valid": True, "backup_code_used": True, "remaining_codes": len(codes)}

    raise HTTPException(400, "Invalid 2FA code")


@router.delete("/2fa")
async def disable_2fa(
    current_user: User = Depends(get_current_user),
):
    """Disable 2FA."""
    secret_key = f"user:{current_user.id}:2fa_secret"
    await redis_service.delete(secret_key)
    return {"enabled": False, "message": "2FA disabled"}


@router.get("/2fa/status")
async def get_2fa_status(current_user: User = Depends(get_current_user)):
    secret_key = f"user:{current_user.id}:2fa_secret"
    has_2fa = await redis_service.get(secret_key) is not None
    return {"enabled": has_2fa}


# ─── Device Management ───────────────────────────────────────

@router.post("/devices/register")
async def register_device(
    req: DeviceRegisterRequest,
    current_user: User = Depends(get_current_user),
):
    device = await security_service.register_device(
        str(current_user.id),
        req.fingerprint,
        {"name": req.name, "browser": req.browser, "os": req.os},
    )
    return device


@router.get("/devices")
async def list_devices(current_user: User = Depends(get_current_user)):
    devices = await security_service.list_devices(str(current_user.id))
    return {"devices": devices}


@router.post("/devices/trust")
async def trust_device(
    req: TrustDeviceRequest,
    current_user: User = Depends(get_current_user),
):
    ok = await security_service.trust_device(str(current_user.id), req.device_id)
    if not ok:
        raise HTTPException(404, "Device not found")
    return {"trusted": True}


@router.delete("/devices/{device_id}")
async def revoke_device(
    device_id: str,
    current_user: User = Depends(get_current_user),
):
    await security_service.revoke_device(str(current_user.id), device_id)
    return {"revoked": True}


# ─── E2E Encryption Keys ─────────────────────────────────────

@router.post("/e2e/public-key")
async def store_public_key(
    req: PublicKeyRequest,
    current_user: User = Depends(get_current_user),
):
    await security_service.store_public_key(str(current_user.id), req.public_key)
    return {"stored": True}


@router.get("/e2e/public-key/{user_id}")
async def get_public_key(
    user_id: str,
    current_user: User = Depends(get_current_user),
):
    key = await security_service.get_public_key(user_id)
    if not key:
        raise HTTPException(404, "No public key found")
    return {"user_id": user_id, "public_key": key}


# ─── User Status ─────────────────────────────────────────────

@router.patch("/status")
async def update_status(
    req: StatusUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user status (online, busy, away, invisible, dnd)."""
    valid = {"online", "offline", "busy", "away", "invisible", "dnd"}
    if req.status not in valid:
        raise HTTPException(400, f"Invalid status. Must be one of: {', '.join(valid)}")

    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one_or_none()
    if user:
        user.status = req.status
        await db.commit()

    # Broadcast presence (invisible shows as offline to others)
    from app.routers.websocket import _broadcast_presence
    broadcast_status = "offline" if req.status == "invisible" else req.status
    await _broadcast_presence(str(current_user.id), broadcast_status)

    return {"status": req.status}


# ─── Favorites ───────────────────────────────────────────────

@router.post("/favorites/{friend_id}")
async def add_favorite(
    friend_id: str,
    current_user: User = Depends(get_current_user),
):
    import json
    key = f"user:{current_user.id}:favorites"
    raw = await redis_service.get(key)
    favs = json.loads(raw) if raw else []
    if friend_id not in favs:
        favs.append(friend_id)
    await redis_service.set(key, json.dumps(favs), ex=86400 * 365)
    return {"favorites": favs}


@router.delete("/favorites/{friend_id}")
async def remove_favorite(
    friend_id: str,
    current_user: User = Depends(get_current_user),
):
    import json
    key = f"user:{current_user.id}:favorites"
    raw = await redis_service.get(key)
    favs = json.loads(raw) if raw else []
    favs = [f for f in favs if f != friend_id]
    await redis_service.set(key, json.dumps(favs), ex=86400 * 365)
    return {"favorites": favs}


@router.get("/favorites")
async def get_favorites(current_user: User = Depends(get_current_user)):
    import json
    key = f"user:{current_user.id}:favorites"
    raw = await redis_service.get(key)
    return {"favorites": json.loads(raw) if raw else []}


# ─── Contact Groups ──────────────────────────────────────────

class ContactGroupRequest(BaseModel):
    name: str
    member_ids: list[str] = []

@router.post("/contact-groups")
async def create_contact_group(
    req: ContactGroupRequest,
    current_user: User = Depends(get_current_user),
):
    import json, uuid
    group_id = str(uuid.uuid4())[:8]
    group = {"id": group_id, "name": req.name, "member_ids": req.member_ids}
    key = f"user:{current_user.id}:contact_groups"
    raw = await redis_service.get(key)
    groups = json.loads(raw) if raw else []
    groups.append(group)
    await redis_service.set(key, json.dumps(groups), ex=86400 * 365)
    return group


@router.get("/contact-groups")
async def list_contact_groups(current_user: User = Depends(get_current_user)):
    import json
    key = f"user:{current_user.id}:contact_groups"
    raw = await redis_service.get(key)
    return {"groups": json.loads(raw) if raw else []}


@router.delete("/contact-groups/{group_id}")
async def delete_contact_group(
    group_id: str,
    current_user: User = Depends(get_current_user),
):
    import json
    key = f"user:{current_user.id}:contact_groups"
    raw = await redis_service.get(key)
    groups = json.loads(raw) if raw else []
    groups = [g for g in groups if g.get("id") != group_id]
    await redis_service.set(key, json.dumps(groups), ex=86400 * 365)
    return {"deleted": True}
