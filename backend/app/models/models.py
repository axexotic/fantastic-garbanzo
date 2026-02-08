"""SQLAlchemy models — Users, Calls, VoiceProfiles."""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    preferred_language = Column(String(10), default="en")
    persona = Column(Text, default="")  # e.g., "Business executive, formal"
    industry = Column(String(100), default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    voice_profile = relationship("VoiceProfile", back_populates="user", uselist=False)
    calls = relationship("CallParticipant", back_populates="user")


class VoiceProfile(Base):
    __tablename__ = "voice_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    elevenlabs_voice_id = Column(String(255), nullable=False)
    s3_sample_key = Column(String(500))  # S3 key for original voice sample
    status = Column(String(50), default="active")  # active, processing, failed
    quality_score = Column(Float)  # A/B test quality rating
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="voice_profile")


class Call(Base):
    __tablename__ = "calls"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_name = Column(String(255), nullable=False, index=True)
    daily_room_url = Column(String(500))
    status = Column(String(50), default="active")  # active, completed, failed
    duration_seconds = Column(Float, default=0)
    languages = Column(ARRAY(String), default=[])
    metadata_ = Column("metadata", JSONB, default={})
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime)

    # Relationships
    participants = relationship("CallParticipant", back_populates="call")
    translations = relationship("TranslationLog", back_populates="call")


class CallParticipant(Base):
    __tablename__ = "call_participants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    call_id = Column(UUID(as_uuid=True), ForeignKey("calls.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    language = Column(String(10), nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow)
    left_at = Column(DateTime)

    call = relationship("Call", back_populates="participants")
    user = relationship("User", back_populates="calls")


class TranslationLog(Base):
    """Log every translation for quality improvement and analytics."""

    __tablename__ = "translation_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    call_id = Column(UUID(as_uuid=True), ForeignKey("calls.id"), nullable=False)
    source_language = Column(String(10), nullable=False)
    target_language = Column(String(10), nullable=False)
    source_text = Column(Text, nullable=False)
    translated_text = Column(Text, nullable=False)
    stt_latency_ms = Column(Float)
    translate_latency_ms = Column(Float)
    tts_latency_ms = Column(Float)
    total_latency_ms = Column(Float)
    model_used = Column(String(50))  # gpt-4-turbo, claude-3.5-sonnet
    created_at = Column(DateTime, default=datetime.utcnow)

    call = relationship("Call", back_populates="translations")
