"""Auth router — signup, login, me, password reset."""

import asyncio
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user
from app.models.database import get_db
from app.models.models import User
from app.services.auth_service import create_access_token, hash_password, verify_password
from app.services.email_service import email_service
from app.services.redis_service import redis_service

router = APIRouter()


# ─── Schemas ────────────────────────────────────────────────

class SignupRequest(BaseModel):
    email: str
    username: str
    display_name: str
    password: str
    preferred_language: str = "en"


class LoginRequest(BaseModel):
    login: str  # email or username
    password: str


class AuthResponse(BaseModel):
    token: str
    user: dict


class UserProfile(BaseModel):
    id: str
    email: str
    username: str
    display_name: str
    avatar_url: str
    preferred_language: str
    status: str
    bio: str


class UpdateProfileRequest(BaseModel):
    display_name: str | None = None
    preferred_language: str | None = None
    bio: str | None = None
    avatar_url: str | None = None


# ─── Helpers ────────────────────────────────────────────────

def user_to_dict(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "username": user.username,
        "display_name": user.display_name,
        "avatar_url": user.avatar_url,
        "preferred_language": user.preferred_language,
        "status": user.status,
        "bio": user.bio,
    }


# ─── Endpoints ──────────────────────────────────────────────

@router.post("/signup", response_model=AuthResponse, status_code=201)
async def signup(req: SignupRequest, db: AsyncSession = Depends(get_db)):
    """Create a new user account."""
    # Check existing
    result = await db.execute(
        select(User).where(or_(User.email == req.email, User.username == req.username))
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email or username already taken")

    user = User(
        email=req.email,
        username=req.username,
        display_name=req.display_name,
        password_hash=hash_password(req.password),
        preferred_language=req.preferred_language,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(str(user.id))

    # Fire-and-forget welcome email
    asyncio.create_task(email_service.send_welcome(user.email, user.display_name))

    return AuthResponse(token=token, user=user_to_dict(user))


@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login with email/username + password."""
    result = await db.execute(
        select(User).where(or_(User.email == req.login, User.username == req.login))
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Update status
    user.status = "online"
    user.last_seen_at = datetime.utcnow()
    await db.commit()

    token = create_access_token(str(user.id))
    return AuthResponse(token=token, user=user_to_dict(user))


@router.get("/me", response_model=UserProfile)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user profile."""
    return user_to_dict(current_user)


@router.patch("/me", response_model=UserProfile)
async def update_profile(
    req: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update current user's profile."""
    if req.display_name is not None:
        current_user.display_name = req.display_name
    if req.preferred_language is not None:
        current_user.preferred_language = req.preferred_language
    if req.bio is not None:
        current_user.bio = req.bio
    if req.avatar_url is not None:
        current_user.avatar_url = req.avatar_url

    await db.commit()
    await db.refresh(current_user)
    return user_to_dict(current_user)


# ─── Password Reset ─────────────────────────────────────────

class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """
    Request a password reset. Sends an email with a reset link.
    Always returns 200 to prevent email enumeration.
    """
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()

    if user:
        # Generate a secure token
        token = secrets.token_urlsafe(48)
        # Store in Redis with 1-hour expiry: password_reset:{token} -> user_id
        await redis_service.set(
            f"password_reset:{token}", str(user.id), expire_seconds=3600
        )
        # Fire-and-forget email
        asyncio.create_task(email_service.send_password_reset(user.email, token))

    # Always return success to avoid email enumeration
    return {"message": "If an account with that email exists, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Reset password using a valid token from the email."""
    # Look up the token in Redis
    user_id = await redis_service.get(f"password_reset:{req.token}")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    # Update password
    user.password_hash = hash_password(req.new_password)
    await db.commit()

    # Delete the used token
    await redis_service.delete(f"password_reset:{req.token}")

    return {"message": "Password has been reset successfully."}
