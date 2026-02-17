"""Security features — 2FA (TOTP), device authorization, E2E encryption keys."""

import hashlib
import hmac
import logging
import secrets
import time
from datetime import datetime
from typing import Optional

from app.services.redis_service import redis_service

logger = logging.getLogger(__name__)


class SecurityService:
    """Handles advanced security features."""

    # ─── Two-Factor Authentication (TOTP) ────────────────────

    def generate_totp_secret(self) -> str:
        """Generate a TOTP secret for a user."""
        return secrets.token_hex(20)

    def generate_totp_code(self, secret: str, interval: int = 30) -> str:
        """Generate current TOTP code from secret."""
        counter = int(time.time()) // interval
        msg = counter.to_bytes(8, byteorder="big")
        h = hmac.new(bytes.fromhex(secret), msg, hashlib.sha1).digest()
        offset = h[-1] & 0x0F
        code = ((h[offset] & 0x7F) << 24 | h[offset + 1] << 16 | h[offset + 2] << 8 | h[offset + 3]) % 1000000
        return f"{code:06d}"

    def verify_totp(self, secret: str, code: str, window: int = 1) -> bool:
        """Verify a TOTP code with a tolerance window."""
        for i in range(-window, window + 1):
            counter = (int(time.time()) // 30) + i
            msg = counter.to_bytes(8, byteorder="big")
            h = hmac.new(bytes.fromhex(secret), msg, hashlib.sha1).digest()
            offset = h[-1] & 0x0F
            expected = ((h[offset] & 0x7F) << 24 | h[offset + 1] << 16 | h[offset + 2] << 8 | h[offset + 3]) % 1000000
            if code == f"{expected:06d}":
                return True
        return False

    def get_totp_uri(self, secret: str, email: str, issuer: str = "FlaskAI") -> str:
        """Generate otpauth:// URI for QR code."""
        import base64
        b32_secret = base64.b32encode(bytes.fromhex(secret)).decode().rstrip("=")
        return f"otpauth://totp/{issuer}:{email}?secret={b32_secret}&issuer={issuer}&algorithm=SHA1&digits=6&period=30"

    def generate_backup_codes(self, count: int = 8) -> list[str]:
        """Generate one-time backup codes for 2FA recovery."""
        return [secrets.token_hex(4).upper() for _ in range(count)]

    # ─── Device Authorization ────────────────────────────────

    async def register_device(
        self, user_id: str, device_fingerprint: str, device_info: dict
    ) -> dict:
        """Register a new device for a user."""
        device_id = hashlib.sha256(
            f"{user_id}:{device_fingerprint}".encode()
        ).hexdigest()[:16]

        device = {
            "device_id": device_id,
            "user_id": user_id,
            "fingerprint": device_fingerprint,
            "name": device_info.get("name", "Unknown Device"),
            "browser": device_info.get("browser", "Unknown"),
            "os": device_info.get("os", "Unknown"),
            "ip_address": device_info.get("ip_address", ""),
            "is_trusted": False,
            "registered_at": datetime.utcnow().isoformat(),
            "last_active": datetime.utcnow().isoformat(),
        }

        import json
        key = f"user:{user_id}:device:{device_id}"
        await redis_service.set(key, json.dumps(device), ex=86400 * 90)

        # Add to user's device list
        list_key = f"user:{user_id}:devices"
        devices = await redis_service.get(list_key)
        device_list = json.loads(devices) if devices else []
        if device_id not in device_list:
            device_list.append(device_id)
        await redis_service.set(list_key, json.dumps(device_list), ex=86400 * 90)

        return device

    async def list_devices(self, user_id: str) -> list[dict]:
        """List all registered devices for a user."""
        import json
        list_key = f"user:{user_id}:devices"
        devices_raw = await redis_service.get(list_key)
        if not devices_raw:
            return []

        device_ids = json.loads(devices_raw)
        devices = []
        for did in device_ids:
            key = f"user:{user_id}:device:{did}"
            data = await redis_service.get(key)
            if data:
                devices.append(json.loads(data))
        return devices

    async def trust_device(self, user_id: str, device_id: str) -> bool:
        """Mark a device as trusted."""
        import json
        key = f"user:{user_id}:device:{device_id}"
        data = await redis_service.get(key)
        if not data:
            return False
        device = json.loads(data)
        device["is_trusted"] = True
        await redis_service.set(key, json.dumps(device), ex=86400 * 90)
        return True

    async def revoke_device(self, user_id: str, device_id: str) -> bool:
        """Revoke a device."""
        import json
        key = f"user:{user_id}:device:{device_id}"
        await redis_service.delete(key)

        list_key = f"user:{user_id}:devices"
        devices_raw = await redis_service.get(list_key)
        if devices_raw:
            device_list = json.loads(devices_raw)
            device_list = [d for d in device_list if d != device_id]
            await redis_service.set(list_key, json.dumps(device_list), ex=86400 * 90)
        return True

    # ─── E2E Encryption Key Exchange ─────────────────────────

    async def store_public_key(self, user_id: str, public_key: str) -> bool:
        """Store user's public key for E2E encryption."""
        key = f"user:{user_id}:e2e_public_key"
        await redis_service.set(key, public_key, ex=86400 * 365)
        return True

    async def get_public_key(self, user_id: str) -> Optional[str]:
        """Get a user's public key."""
        key = f"user:{user_id}:e2e_public_key"
        return await redis_service.get(key)

    async def store_session_key(
        self, call_id: str, encrypted_key: str, for_user: str
    ) -> bool:
        """Store an encrypted session key for a call participant."""
        key = f"call:{call_id}:session_key:{for_user}"
        await redis_service.set(key, encrypted_key, ex=86400)
        return True

    async def get_session_key(self, call_id: str, user_id: str) -> Optional[str]:
        key = f"call:{call_id}:session_key:{user_id}"
        return await redis_service.get(key)

    # ─── Role-Based Call Access ──────────────────────────────

    async def set_call_role(
        self, call_id: str, user_id: str, role: str
    ) -> bool:
        """Set a user's role in a call (host, co-host, participant, viewer)."""
        key = f"call:{call_id}:role:{user_id}"
        await redis_service.set(key, role, ex=86400)
        return True

    async def get_call_role(self, call_id: str, user_id: str) -> str:
        """Get a user's role in a call."""
        key = f"call:{call_id}:role:{user_id}"
        role = await redis_service.get(key)
        return role or "participant"

    async def get_call_permissions(self, call_id: str, user_id: str) -> dict:
        """Get permissions based on user's role."""
        role = await self.get_call_role(call_id, user_id)
        permissions = {
            "host": {
                "can_mute_others": True, "can_remove": True, "can_record": True,
                "can_share_screen": True, "can_lock": True, "can_end_for_all": True,
                "can_create_poll": True, "can_transfer": True,
            },
            "co-host": {
                "can_mute_others": True, "can_remove": False, "can_record": True,
                "can_share_screen": True, "can_lock": False, "can_end_for_all": False,
                "can_create_poll": True, "can_transfer": False,
            },
            "participant": {
                "can_mute_others": False, "can_remove": False, "can_record": False,
                "can_share_screen": True, "can_lock": False, "can_end_for_all": False,
                "can_create_poll": False, "can_transfer": False,
            },
            "viewer": {
                "can_mute_others": False, "can_remove": False, "can_record": False,
                "can_share_screen": False, "can_lock": False, "can_end_for_all": False,
                "can_create_poll": False, "can_transfer": False,
            },
        }
        return {"role": role, **permissions.get(role, permissions["participant"])}


# Singleton
security_service = SecurityService()
