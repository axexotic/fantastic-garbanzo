"""Push notifications and offline alerts system."""

import json
from datetime import datetime, timedelta
from typing import Dict, List, Literal
from app.services.redis_service import redis_service

NotificationType = Literal["call", "message", "friend_request", "system"]


class NotificationsService:
    """Manage push notifications and offline alert delivery."""

    @staticmethod
    async def register_device(
        user_id: str, device_token: str, device_info: Dict
    ) -> Dict:
        """Register device for push notifications."""
        key = f"user:{user_id}:devices:{device_token}"
        
        device = {
            "user_id": user_id,
            "token": device_token,
            "platform": device_info.get("platform", "web"),  # web, ios, android
            "app_version": device_info.get("app_version", "1.0.0"),
            "os": device_info.get("os", "unknown"),
            "registered_at": datetime.utcnow().isoformat(),
            "is_active": True,
            "last_seen": datetime.utcnow().isoformat(),
        }
        
        await redis_service.redis.setex(key, 2592000, json.dumps(device))  # 30 days
        return device

    @staticmethod
    async def unregister_device(user_id: str, device_token: str) -> Dict:
        """Unregister device from push notifications."""
        key = f"user:{user_id}:devices:{device_token}"
        await redis_service.redis.delete(key)
        return {"status": "unregistered"}

    @staticmethod
    async def send_notification(
        user_id: str,
        title: str,
        body: str,
        notif_type: NotificationType = "system",
        data: Dict = None,
    ) -> Dict:
        """Send notification to user devices."""
        key = f"user:{user_id}:notifications:inbox"
        
        notification = {
            "id": f"notif_{int(__import__('time').time())}",
            "user_id": user_id,
            "title": title,
            "body": body,
            "type": notif_type,
            "data": data or {},
            "created_at": datetime.utcnow().isoformat(),
            "is_read": False,
            "delivered_at": None,
        }
        
        # Store in notification inbox
        await redis_service.redis.lpush(key, json.dumps(notification))
        await redis_service.redis.ltrim(key, 0, 99)  # Keep last 100
        await redis_service.redis.expire(key, 604800)  # 7 days
        
        return notification

    @staticmethod
    async def get_notifications(user_id: str, limit: int = 50) -> Dict:
        """Get user's notifications."""
        key = f"user:{user_id}:notifications:inbox"
        data = await redis_service.redis.lrange(key, 0, limit - 1)
        
        notifications = [json.loads(n) for n in data]
        
        return {
            "notifications": notifications,
            "total": len(notifications),
            "unread": sum(1 for n in notifications if not n.get("is_read")),
        }

    @staticmethod
    async def mark_as_read(user_id: str, notification_id: str) -> Dict:
        """Mark notification as read."""
        key = f"user:{user_id}:notifications:read"
        
        await redis_service.redis.sadd(key, notification_id)
        await redis_service.redis.expire(key, 604800)
        
        return {"status": "marked_read"}

    @staticmethod
    async def send_offline_alert(user_id: str, from_user: str, message: str) -> Dict:
        """Store message for offline user, deliver when online."""
        key = f"user:{user_id}:offline_alerts"
        
        alert = {
            "from_user": from_user,
            "message": message,
            "created_at": datetime.utcnow().isoformat(),
            "delivered": False,
        }
        
        await redis_service.redis.lpush(key, json.dumps(alert))
        await redis_service.redis.ltrim(key, 0, 99)
        await redis_service.redis.expire(key, 604800)  # 7 days
        
        return alert

    @staticmethod
    async def get_offline_alerts(user_id: str) -> List[Dict]:
        """Get pending offline alerts for user."""
        key = f"user:{user_id}:offline_alerts"
        data = await redis_service.redis.lrange(key, 0, -1)
        
        alerts = [json.loads(a) for a in data]
        return alerts

    @staticmethod
    async def clear_offline_alerts(user_id: str) -> Dict:
        """Clear offline alerts after delivery."""
        key = f"user:{user_id}:offline_alerts"
        await redis_service.redis.delete(key)
        return {"status": "cleared"}

    @staticmethod
    async def set_notification_preferences(user_id: str, prefs: Dict) -> Dict:
        """Set user's notification preferences."""
        key = f"user:{user_id}:notification_prefs"
        
        defaults = {
            "push_enabled": True,
            "email_enabled": True,
            "sms_enabled": False,
            "call_notifications": True,
            "message_notifications": True,
            "friend_request_notifications": True,
            "sound_enabled": True,
            "vibration_enabled": True,
            "quiet_hours_start": None,
            "quiet_hours_end": None,
            "quiet_hours_mute_all": False,
        }
        
        preferences = {**defaults, **prefs}
        
        await redis_service.redis.setex(key, 2592000, json.dumps(preferences))
        return preferences

    @staticmethod
    async def get_notification_preferences(user_id: str) -> Dict:
        """Get user's notification preferences."""
        key = f"user:{user_id}:notification_prefs"
        data = await redis_service.redis.get(key)
        
        defaults = {
            "push_enabled": True,
            "email_enabled": True,
            "sms_enabled": False,
            "call_notifications": True,
            "message_notifications": True,
            "friend_request_notifications": True,
            "sound_enabled": True,
            "vibration_enabled": True,
        }
        
        return json.loads(data) if data else defaults

    @staticmethod
    async def schedule_notification(
        user_id: str,
        title: str,
        body: str,
        delay_seconds: int,
        data: Dict = None,
    ) -> Dict:
        """Schedule notification to be sent later."""
        key = f"user:{user_id}:scheduled_notifications"
        scheduled_notif = {
            "title": title,
            "body": body,
            "delay_seconds": delay_seconds,
            "scheduled_for": (
                datetime.utcnow() + timedelta(seconds=delay_seconds)
            ).isoformat(),
            "data": data or {},
        }
        
        await redis_service.redis.lpush(key, json.dumps(scheduled_notif))
        
        return scheduled_notif

    @staticmethod
    async def notify_call_incoming(
        user_id: str, caller_name: str, call_id: str
    ) -> Dict:
        """Send incoming call notification."""
        return await NotificationsService.send_notification(
            user_id,
            "Incoming Call",
            f"{caller_name} is calling...",
            notif_type="call",
            data={"call_id": call_id, "action": "answer"},
        )

    @staticmethod
    async def notify_call_missed(user_id: str, caller_name: str) -> Dict:
        """Notify user of missed call."""
        return await NotificationsService.send_notification(
            user_id,
            "Missed Call",
            f"You missed a call from {caller_name}",
            notif_type="call",
        )
