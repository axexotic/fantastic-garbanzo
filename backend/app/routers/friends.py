"""Friends router — send/accept/reject requests, list friends, unfriend."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_current_user
from app.models.database import get_db
from app.models.models import FriendRequest, Friendship, User

router = APIRouter()


# ─── Schemas ────────────────────────────────────────────────

class SendFriendRequestBody(BaseModel):
    username: str
    message: str = ""


class FriendRequestResponse(BaseModel):
    id: str
    sender: dict
    receiver: dict
    status: str
    message: str
    created_at: str


class FriendResponse(BaseModel):
    id: str
    username: str
    display_name: str
    avatar_url: str
    preferred_language: str
    status: str  # online/offline


def user_brief(u: User) -> dict:
    return {
        "id": str(u.id),
        "username": u.username,
        "display_name": u.display_name,
        "avatar_url": u.avatar_url,
        "preferred_language": u.preferred_language,
        "status": u.status,
    }


# ─── Send Friend Request ───────────────────────────────────

@router.post("/request")
async def send_friend_request(
    body: SendFriendRequestBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a friend request to another user by username."""
    # Find target user
    result = await db.execute(select(User).where(User.username == body.username))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot friend yourself")

    # Check if already friends
    existing = await db.execute(
        select(Friendship).where(
            Friendship.user_id == current_user.id,
            Friendship.friend_id == target.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already friends")

    # Check existing pending request in either direction
    existing_req = await db.execute(
        select(FriendRequest).where(
            FriendRequest.status == "pending",
            or_(
                and_(
                    FriendRequest.sender_id == current_user.id,
                    FriendRequest.receiver_id == target.id,
                ),
                and_(
                    FriendRequest.sender_id == target.id,
                    FriendRequest.receiver_id == current_user.id,
                ),
            ),
        )
    )
    if existing_req.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Friend request already pending")

    req = FriendRequest(
        sender_id=current_user.id,
        receiver_id=target.id,
        message=body.message,
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)

    return {"id": str(req.id), "status": "pending", "to": body.username}


# ─── Accept / Reject Request ───────────────────────────────

@router.post("/request/{request_id}/accept")
async def accept_friend_request(
    request_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Accept a friend request."""
    result = await db.execute(
        select(FriendRequest).where(
            FriendRequest.id == request_id,
            FriendRequest.receiver_id == current_user.id,
            FriendRequest.status == "pending",
        )
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    req.status = "accepted"
    req.responded_at = datetime.now(timezone.utc)

    # Create bidirectional friendship
    db.add(Friendship(user_id=req.sender_id, friend_id=req.receiver_id))
    db.add(Friendship(user_id=req.receiver_id, friend_id=req.sender_id))

    await db.commit()
    return {"status": "accepted"}


@router.post("/request/{request_id}/reject")
async def reject_friend_request(
    request_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reject a friend request."""
    result = await db.execute(
        select(FriendRequest).where(
            FriendRequest.id == request_id,
            FriendRequest.receiver_id == current_user.id,
            FriendRequest.status == "pending",
        )
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    req.status = "rejected"
    req.responded_at = datetime.now(timezone.utc)
    await db.commit()
    return {"status": "rejected"}


# ─── List Pending Requests ──────────────────────────────────

@router.get("/requests/incoming")
async def get_incoming_requests(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get pending friend requests received by the current user."""
    result = await db.execute(
        select(FriendRequest)
        .options(selectinload(FriendRequest.sender))
        .where(
            FriendRequest.receiver_id == current_user.id,
            FriendRequest.status == "pending",
        )
        .order_by(FriendRequest.created_at.desc())
    )
    requests = result.scalars().all()

    return [
        {
            "id": str(r.id),
            "sender": user_brief(r.sender),
            "message": r.message,
            "created_at": r.created_at.isoformat(),
        }
        for r in requests
    ]


@router.get("/requests/outgoing")
async def get_outgoing_requests(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get pending friend requests sent by the current user."""
    result = await db.execute(
        select(FriendRequest)
        .options(selectinload(FriendRequest.receiver))
        .where(
            FriendRequest.sender_id == current_user.id,
            FriendRequest.status == "pending",
        )
        .order_by(FriendRequest.created_at.desc())
    )
    requests = result.scalars().all()

    return [
        {
            "id": str(r.id),
            "receiver": user_brief(r.receiver),
            "message": r.message,
            "created_at": r.created_at.isoformat(),
        }
        for r in requests
    ]


# ─── List Friends ──────────────────────────────────────────

@router.get("/")
async def list_friends(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all friends of the current user."""
    result = await db.execute(
        select(Friendship)
        .options(selectinload(Friendship.friend))
        .where(Friendship.user_id == current_user.id)
        .order_by(Friendship.created_at.desc())
    )
    friendships = result.scalars().all()

    return [user_brief(f.friend) for f in friendships]


# ─── Unfriend ───────────────────────────────────────────────

@router.delete("/{friend_id}")
async def unfriend(
    friend_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a friend (bidirectional)."""
    # Delete both directions
    result1 = await db.execute(
        select(Friendship).where(
            Friendship.user_id == current_user.id,
            Friendship.friend_id == friend_id,
        )
    )
    result2 = await db.execute(
        select(Friendship).where(
            Friendship.user_id == friend_id,
            Friendship.friend_id == current_user.id,
        )
    )

    f1 = result1.scalar_one_or_none()
    f2 = result2.scalar_one_or_none()

    if not f1:
        raise HTTPException(status_code=404, detail="Not friends")

    if f1:
        await db.delete(f1)
    if f2:
        await db.delete(f2)

    await db.commit()
    return {"status": "unfriended"}


# ─── Search Users ───────────────────────────────────────────

@router.get("/search")
async def search_users(
    q: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Search users by username or display name."""
    result = await db.execute(
        select(User)
        .where(
            User.id != current_user.id,
            User.is_active == True,
            or_(
                User.username.ilike(f"%{q}%"),
                User.display_name.ilike(f"%{q}%"),
            ),
        )
        .limit(20)
    )
    users = result.scalars().all()
    return [user_brief(u) for u in users]
