"""SQLAlchemy models — Social Chat Platform with Translation."""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


# ─── Users & Auth ───────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    display_name = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    avatar_url = Column(String(500), default="")
    preferred_language = Column(String(10), default="en")
    status = Column(String(50), default="offline")  # online, offline, busy, away
    bio = Column(Text, default="")
    is_active = Column(Boolean, default=True)
    last_seen_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    voice_profile = relationship("VoiceProfile", back_populates="user", uselist=False)
    sent_friend_requests = relationship(
        "FriendRequest",
        foreign_keys="FriendRequest.sender_id",
        back_populates="sender",
    )
    received_friend_requests = relationship(
        "FriendRequest",
        foreign_keys="FriendRequest.receiver_id",
        back_populates="receiver",
    )
    friendships = relationship(
        "Friendship",
        foreign_keys="Friendship.user_id",
        back_populates="user",
    )
    chat_memberships = relationship("ChatMember", back_populates="user")
    messages = relationship("Message", back_populates="sender")


# ─── Friends System ─────────────────────────────────────────

class FriendRequest(Base):
    __tablename__ = "friend_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    receiver_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status = Column(String(20), default="pending")  # pending, accepted, rejected
    message = Column(Text, default="")  # optional message with request
    created_at = Column(DateTime, default=datetime.utcnow)
    responded_at = Column(DateTime)

    sender = relationship("User", foreign_keys=[sender_id], back_populates="sent_friend_requests")
    receiver = relationship(
        "User", foreign_keys=[receiver_id], back_populates="received_friend_requests"
    )

    __table_args__ = (
        UniqueConstraint("sender_id", "receiver_id", name="uq_friend_request"),
    )


class Friendship(Base):
    __tablename__ = "friendships"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    friend_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id], back_populates="friendships")
    friend = relationship("User", foreign_keys=[friend_id])

    __table_args__ = (
        UniqueConstraint("user_id", "friend_id", name="uq_friendship"),
    )


# ─── Chat & Messaging ──────────────────────────────────────

class Chat(Base):
    """A chat room — either 1:1 (dm) or group."""

    __tablename__ = "chats"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), default="")  # group name (empty for DMs)
    chat_type = Column(String(20), default="dm")  # dm, group
    avatar_url = Column(String(500), default="")
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    members = relationship("ChatMember", back_populates="chat", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="chat", cascade="all, delete-orphan")
    calls = relationship("Call", back_populates="chat")


class ChatMember(Base):
    """Membership in a chat with per-user language preference."""

    __tablename__ = "chat_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chat_id = Column(UUID(as_uuid=True), ForeignKey("chats.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    language = Column(String(10), default="en")  # this user's language IN this chat
    role = Column(String(20), default="member")  # admin, member
    nickname = Column(String(100), default="")
    is_muted = Column(Boolean, default=False)
    joined_at = Column(DateTime, default=datetime.utcnow)
    last_read_at = Column(DateTime, default=datetime.utcnow)

    chat = relationship("Chat", back_populates="members")
    user = relationship("User", back_populates="chat_memberships")

    __table_args__ = (
        UniqueConstraint("chat_id", "user_id", name="uq_chat_member"),
    )


class Message(Base):
    """A message in a chat — stores original + translations."""

    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chat_id = Column(UUID(as_uuid=True), ForeignKey("chats.id"), nullable=False, index=True)
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)  # original message
    source_language = Column(String(10), nullable=False)
    message_type = Column(String(20), default="text")  # text, image, voice, system
    # Translations stored as JSON: { "en": "Hello", "th": "สวัสดี", ... }
    translations = Column(JSONB, default={})
    reply_to_id = Column(UUID(as_uuid=True), ForeignKey("messages.id"), nullable=True)
    is_edited = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    chat = relationship("Chat", back_populates="messages")
    sender = relationship("User", back_populates="messages")
    reply_to = relationship("Message", remote_side="Message.id")


# ─── Calls ──────────────────────────────────────────────────

class Call(Base):
    """A voice/video call — can be 1:1 or group, linked to a chat."""

    __tablename__ = "calls"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chat_id = Column(UUID(as_uuid=True), ForeignKey("chats.id"), nullable=False)
    room_name = Column(String(255), nullable=False, index=True)
    daily_room_url = Column(String(500))
    call_type = Column(String(20), default="voice")  # voice, video
    status = Column(String(50), default="ringing")  # ringing, active, completed, missed
    initiated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    duration_seconds = Column(Float, default=0)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime)

    # Recording metadata
    is_recorded = Column(Boolean, default=False)
    recording_url = Column(String(500))
    recording_s3_key = Column(String(500))
    recording_size_bytes = Column(Integer)
    recording_duration_seconds = Column(Float)

    chat = relationship("Chat", back_populates="calls")
    initiator = relationship("User", foreign_keys=[initiated_by])
    participants = relationship("CallParticipant", back_populates="call")


class CallParticipant(Base):
    __tablename__ = "call_participants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    call_id = Column(UUID(as_uuid=True), ForeignKey("calls.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    language = Column(String(10), nullable=False)
    status = Column(String(20), default="invited")  # invited, joined, left, declined
    joined_at = Column(DateTime)
    left_at = Column(DateTime)

    call = relationship("Call", back_populates="participants")
    user = relationship("User")


# ─── Voice Profiles ─────────────────────────────────────────

class VoiceProfile(Base):
    __tablename__ = "voice_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    elevenlabs_voice_id = Column(String(255), nullable=False)
    s3_sample_key = Column(String(500))
    status = Column(String(50), default="active")
    quality_score = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="voice_profile")


# ─── Subscriptions ──────────────────────────────────────────

class Subscription(Base):
    """Stripe subscription for a user — free, pro, enterprise."""

    __tablename__ = "subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    stripe_customer_id = Column(String(255), unique=True)
    stripe_subscription_id = Column(String(255), unique=True)
    plan = Column(String(50), default="free")  # free, pro, enterprise
    status = Column(String(50), default="active")  # active, canceled, past_due, trialing
    current_period_start = Column(DateTime)
    current_period_end = Column(DateTime)
    cancel_at_period_end = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", backref="subscription")


# ─── Translation Logs ───────────────────────────────────────

class TranslationLog(Base):
    __tablename__ = "translation_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id = Column(UUID(as_uuid=True), ForeignKey("messages.id"), nullable=True)
    call_id = Column(UUID(as_uuid=True), ForeignKey("calls.id"), nullable=True)
    source_language = Column(String(10), nullable=False)
    target_language = Column(String(10), nullable=False)
    source_text = Column(Text, nullable=False)
    translated_text = Column(Text, nullable=False)
    latency_ms = Column(Float)
    model_used = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)


# ─── Webhook Configs ────────────────────────────────────────

class WebhookConfig(Base):
    """User-configured webhook for third-party integrations."""

    __tablename__ = "webhook_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    provider = Column(String(50), nullable=False)  # slack, teams, generic
    webhook_url = Column(String(1000), nullable=False)
    events = Column(ARRAY(String), default=[])  # list of event types
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", backref="webhooks")


# ─── Notification Preferences ───────────────────────────────

class NotificationPreference(Base):
    """Per-user notification preferences."""

    __tablename__ = "notification_preferences"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)

    # Email notifications
    email_messages = Column(Boolean, default=False)
    email_calls = Column(Boolean, default=True)
    email_friend_requests = Column(Boolean, default=True)

    # Push / in-app notifications
    push_messages = Column(Boolean, default=True)
    push_calls = Column(Boolean, default=True)
    push_friend_requests = Column(Boolean, default=True)

    # Sound
    sound_enabled = Column(Boolean, default=True)

    # Do Not Disturb
    dnd_enabled = Column(Boolean, default=False)
    dnd_start = Column(String(5), default="22:00")   # HH:MM
    dnd_end = Column(String(5), default="08:00")      # HH:MM

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", backref="notification_preferences")
