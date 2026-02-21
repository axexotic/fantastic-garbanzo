"""Auth router — signup, login, me, password reset, token refresh, avatar upload."""

import asyncio
import secrets
import uuid
from datetime import datetime, timedelta

import boto3
from botocore.exceptions import ClientError
from fastapi import APIRouter, Cookie, Depends, File, HTTPException, Request, Response, UploadFile, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.dependencies import get_current_user
from app.models.database import get_db
from app.models.models import User
from app.services.auth_service import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_password,
    verify_password,
)
from app.services.email_service import email_service
from app.services.redis_service import redis_service

router = APIRouter()


# ─── Schemas ────────────────────────────────────────────────

class SignupRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    username: str = Field(..., min_length=3, max_length=30, pattern=r"^[a-zA-Z0-9_]+$")
    display_name: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=8, max_length=128)
    preferred_language: str = "en"

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Invalid email format")
        return v.lower().strip()

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        if not any(c.isalpha() for c in v):
            raise ValueError("Password must contain at least one letter")
        return v


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
    display_name: str | None = Field(None, min_length=1, max_length=50)
    preferred_language: str | None = None
    bio: str | None = Field(None, max_length=500)
    avatar_url: str | None = None


# ─── Cookie Helpers ─────────────────────────────────────────

def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """Set HTTP-only secure cookies for both tokens + CSRF cookie."""
    import secrets

    settings = get_settings()
    is_prod = not settings.debug

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=is_prod,
        samesite="lax",
        max_age=15 * 60,  # 15 minutes
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=is_prod,
        samesite="lax",
        max_age=7 * 24 * 60 * 60,  # 7 days
        path="/api/auth",  # Only sent to auth endpoints
    )

    # Ensure CSRF cookie exists with correct domain so frontend JS can read it
    csrf_kwargs: dict = dict(
        key="csrf_token",
        value=secrets.token_hex(32),
        httponly=False,
        secure=is_prod,
        samesite="lax",
        max_age=7 * 24 * 60 * 60,
        path="/",
    )
    if settings.cookie_domain:
        csrf_kwargs["domain"] = settings.cookie_domain
    response.set_cookie(**csrf_kwargs)


def _clear_auth_cookies(response: Response) -> None:
    """Clear auth cookies on logout."""
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/api/auth")


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
async def signup(req: SignupRequest, response: Response, db: AsyncSession = Depends(get_db)):
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

    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))

    # Set HTTP-only cookies
    _set_auth_cookies(response, access_token, refresh_token)

    # Fire-and-forget welcome email
    asyncio.create_task(email_service.send_welcome(user.email, user.display_name))

    return AuthResponse(token=access_token, user=user_to_dict(user))


@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
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

    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))

    # Set HTTP-only cookies
    _set_auth_cookies(response, access_token, refresh_token)

    return AuthResponse(token=access_token, user=user_to_dict(user))


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


# ─── Avatar Upload ──────────────────────────────────────────

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_AVATAR_SIZE = 5 * 1024 * 1024  # 5 MB


def _get_s3_client():
    settings = get_settings()
    return boto3.client(
        "s3",
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
        region_name=settings.aws_region,
    )


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload/replace profile picture. Stores on S3 and updates avatar_url."""
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, GIF, or WEBP images allowed")

    data = await file.read()
    if len(data) > MAX_AVATAR_SIZE:
        raise HTTPException(status_code=400, detail="Image must be under 5 MB")

    settings = get_settings()
    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "jpg"
    s3_key = f"avatars/{current_user.id}/{uuid.uuid4().hex}.{ext}"

    s3 = _get_s3_client()
    try:
        s3.put_object(
            Bucket=settings.aws_s3_bucket,
            Key=s3_key,
            Body=data,
            ContentType=file.content_type or "image/jpeg",
        )
    except ClientError as e:
        raise HTTPException(status_code=500, detail="Failed to upload avatar")

    avatar_url = f"https://{settings.aws_s3_bucket}.s3.{settings.aws_region}.amazonaws.com/{s3_key}"
    current_user.avatar_url = avatar_url
    await db.commit()
    await db.refresh(current_user)

    return {"avatar_url": avatar_url, "user": user_to_dict(current_user)}


@router.delete("/avatar")
async def delete_avatar(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove profile picture."""
    current_user.avatar_url = ""
    await db.commit()
    return {"avatar_url": "", "message": "Avatar removed"}


# ─── Change Password ────────────────────────────────────────

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        if not any(c.isalpha() for c in v):
            raise ValueError("Password must contain at least one letter")
        return v


@router.post("/change-password")
async def change_password(
    req: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change password (requires current password)."""
    if not verify_password(req.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    current_user.password_hash = hash_password(req.new_password)
    await db.commit()
    return {"message": "Password changed successfully"}


# ─── Delete Account ─────────────────────────────────────────

class DeleteAccountRequest(BaseModel):
    password: str


@router.post("/delete-account")
async def delete_account(
    req: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete account (deactivate). Requires password confirmation."""
    if not verify_password(req.password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Password is incorrect")

    current_user.is_active = False
    current_user.status = "deleted"
    await db.commit()
    return {"message": "Account has been deactivated"}


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


# ─── Token Refresh & Logout ─────────────────────────────────

@router.post("/refresh")
async def refresh_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """
    Rotate refresh token — issue new access + refresh tokens.
    Reads the refresh token from HTTP-only cookie.
    """
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")

    payload = decode_refresh_token(token)
    if not payload:
        _clear_auth_cookies(response)
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user_id = payload.get("sub")
    jti = payload.get("jti", "")

    # Check if this refresh token has been revoked (one-time use)
    if await redis_service.get(f"revoked_refresh:{jti}"):
        # Possible token theft — revoke all tokens for this user
        _clear_auth_cookies(response)
        raise HTTPException(status_code=401, detail="Token has been revoked")

    # Revoke the old refresh token
    await redis_service.set(f"revoked_refresh:{jti}", "1", expire_seconds=7 * 24 * 3600)

    # Verify user still exists and is active
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        _clear_auth_cookies(response)
        raise HTTPException(status_code=401, detail="User not found or inactive")

    # Issue new tokens (rotation)
    new_access = create_access_token(user_id)
    new_refresh = create_refresh_token(user_id)
    _set_auth_cookies(response, new_access, new_refresh)

    return {"token": new_access, "message": "Tokens refreshed"}


@router.post("/logout")
async def logout(request: Request, response: Response):
    """Clear auth cookies and revoke refresh token."""
    token = request.cookies.get("refresh_token")
    if token:
        payload = decode_refresh_token(token)
        if payload and payload.get("jti"):
            await redis_service.set(
                f"revoked_refresh:{payload['jti']}", "1", expire_seconds=7 * 24 * 3600
            )

    _clear_auth_cookies(response)
    return {"message": "Logged out"}
