"""Chat router — create chats, list chats, send messages, group management."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import and_, select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_current_user
from app.models.database import get_db
from app.models.models import Chat, ChatMember, Friendship, Message, User
from app.services.translation_service import translation_service
from app.services.credit_service import credit_service
from app.routers.websocket import notify_group_update, manager

router = APIRouter()


# ─── Schemas ────────────────────────────────────────────────

class CreateDMRequest(BaseModel):
    friend_id: str


class CreateGroupRequest(BaseModel):
    name: str
    member_ids: list[str]  # list of user IDs to invite


class SendMessageRequest(BaseModel):
    content: str
    message_type: str = "text"
    reply_to_id: str | None = None


class UpdateGroupRequest(BaseModel):
    name: str | None = None
    avatar_url: str | None = None


class AddMembersRequest(BaseModel):
    user_ids: list[str]


class SetLanguageRequest(BaseModel):
    language: str


# ─── Helpers ────────────────────────────────────────────────

def user_brief(u: User) -> dict:
    return {
        "id": str(u.id),
        "username": u.username,
        "display_name": u.display_name,
        "avatar_url": u.avatar_url,
        "preferred_language": u.preferred_language,
        "status": u.status,
    }


async def get_chat_with_access(
    chat_id: str, user_id, db: AsyncSession
) -> tuple[Chat, ChatMember]:
    """Get chat and verify user is a member. Returns (chat, membership)."""
    result = await db.execute(
        select(Chat)
        .options(selectinload(Chat.members).selectinload(ChatMember.user))
        .where(Chat.id == chat_id)
    )
    chat = result.scalar_one_or_none()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    membership = next(
        (m for m in chat.members if str(m.user_id) == str(user_id)), None
    )
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this chat")

    return chat, membership


def format_message(msg: Message, viewer_language: str) -> dict:
    """Format a message for the viewer, including translated content."""
    translated = msg.translations or {}
    content_for_viewer = translated.get(viewer_language, msg.content)

    return {
        "id": str(msg.id),
        "chat_id": str(msg.chat_id),
        "sender_id": str(msg.sender_id),
        "content": msg.content,
        "translated_content": content_for_viewer,
        "source_language": msg.source_language,
        "translations": msg.translations or {},
        "message_type": msg.message_type,
        "reply_to_id": str(msg.reply_to_id) if msg.reply_to_id else None,
        "is_edited": msg.is_edited,
        "created_at": msg.created_at.isoformat(),
    }


# ─── Create DM ─────────────────────────────────────────────

@router.post("/dm")
async def create_dm(
    body: CreateDMRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create or get a 1:1 DM chat with a friend."""
    # Verify they're friends
    result = await db.execute(
        select(Friendship).where(
            Friendship.user_id == current_user.id,
            Friendship.friend_id == body.friend_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="You must be friends to start a DM")

    # Check if DM already exists between these two users
    my_chats = await db.execute(
        select(ChatMember.chat_id).where(ChatMember.user_id == current_user.id)
    )
    my_chat_ids = [row[0] for row in my_chats.all()]

    if my_chat_ids:
        their_chats = await db.execute(
            select(ChatMember.chat_id).where(
                ChatMember.user_id == body.friend_id,
                ChatMember.chat_id.in_(my_chat_ids),
            )
        )
        shared_chat_ids = [row[0] for row in their_chats.all()]

        for cid in shared_chat_ids:
            chat_result = await db.execute(
                select(Chat).where(Chat.id == cid, Chat.chat_type == "dm")
            )
            existing_dm = chat_result.scalar_one_or_none()
            if existing_dm:
                return {"chat_id": str(existing_dm.id), "existing": True}

    # Get friend's info
    friend_result = await db.execute(select(User).where(User.id == body.friend_id))
    friend = friend_result.scalar_one_or_none()
    if not friend:
        raise HTTPException(status_code=404, detail="User not found")

    # Create new DM
    chat = Chat(chat_type="dm", created_by=current_user.id)
    db.add(chat)
    await db.flush()

    # Add both members with their preferred languages
    db.add(ChatMember(
        chat_id=chat.id,
        user_id=current_user.id,
        language=current_user.preferred_language,
        role="member",
    ))
    db.add(ChatMember(
        chat_id=chat.id,
        user_id=friend.id,
        language=friend.preferred_language,
        role="member",
    ))

    await db.commit()
    return {"chat_id": str(chat.id), "existing": False}


# ─── Create Group Chat ─────────────────────────────────────

@router.post("/group")
async def create_group(
    body: CreateGroupRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a group chat and add members."""
    chat = Chat(
        name=body.name,
        chat_type="group",
        created_by=current_user.id,
    )
    db.add(chat)
    await db.flush()

    # Add creator as admin
    db.add(ChatMember(
        chat_id=chat.id,
        user_id=current_user.id,
        language=current_user.preferred_language,
        role="admin",
    ))

    # Add other members
    for uid in body.member_ids:
        user_result = await db.execute(select(User).where(User.id == uid))
        member = user_result.scalar_one_or_none()
        if member:
            db.add(ChatMember(
                chat_id=chat.id,
                user_id=member.id,
                language=member.preferred_language,
                role="member",
            ))

    await db.commit()
    return {"chat_id": str(chat.id), "name": body.name}


# ─── List My Chats ──────────────────────────────────────────

@router.get("/")
async def list_chats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all chats for the current user with last message preview."""
    result = await db.execute(
        select(ChatMember)
        .options(
            selectinload(ChatMember.chat)
            .selectinload(Chat.members)
            .selectinload(ChatMember.user)
        )
        .where(ChatMember.user_id == current_user.id)
        .order_by(ChatMember.joined_at.desc())
    )
    memberships = result.scalars().all()

    chats = []
    for membership in memberships:
        chat = membership.chat

        # Get last message
        last_msg_result = await db.execute(
            select(Message)
            .where(Message.chat_id == chat.id, Message.is_deleted == False)
            .order_by(Message.created_at.desc())
            .limit(1)
        )
        last_msg = last_msg_result.scalar_one_or_none()

        # Unread count
        unread_result = await db.execute(
            select(func.count(Message.id)).where(
                Message.chat_id == chat.id,
                Message.created_at > membership.last_read_at,
                Message.sender_id != current_user.id,
            )
        )
        unread = unread_result.scalar() or 0

        # For DMs, show the other person's info
        other_members = [m for m in chat.members if str(m.user_id) != str(current_user.id)]

        chat_data = {
            "id": str(chat.id),
            "chat_type": chat.chat_type,
            "name": chat.name if chat.chat_type == "group" else (
                other_members[0].user.display_name if other_members else "Unknown"
            ),
            "avatar_url": chat.avatar_url if chat.chat_type == "group" else (
                other_members[0].user.avatar_url if other_members else ""
            ),
            "my_language": membership.language,
            "members": [
                {**user_brief(m.user), "language": m.language, "role": m.role}
                for m in chat.members
            ],
            "last_message": format_message(last_msg, membership.language) if last_msg else None,
            "unread_count": unread,
            "updated_at": chat.updated_at.isoformat(),
        }
        chats.append(chat_data)

    # Sort by last message time
    chats.sort(
        key=lambda c: c["last_message"]["created_at"] if c["last_message"] else c["updated_at"],
        reverse=True,
    )
    return chats


# ─── Get Chat Messages ─────────────────────────────────────

@router.get("/{chat_id}/messages")
async def get_messages(
    chat_id: str,
    limit: int = Query(50, le=100),
    before: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get messages in a chat, translated to the viewer's language."""
    chat, membership = await get_chat_with_access(chat_id, current_user.id, db)

    query = (
        select(Message)
        .options(selectinload(Message.sender))
        .where(Message.chat_id == chat_id, Message.is_deleted == False)
    )

    if before:
        query = query.where(Message.id < before)

    query = query.order_by(Message.created_at.desc()).limit(limit)

    result = await db.execute(query)
    messages = result.scalars().all()

    # Mark as read
    membership.last_read_at = datetime.utcnow()
    await db.commit()

    return [format_message(m, membership.language) for m in reversed(messages)]


# ─── Send Message ───────────────────────────────────────────

@router.post("/{chat_id}/messages")
async def send_message(
    chat_id: str,
    body: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Send a message in a chat.
    Requires $15 lifetime chat plan.
    Automatically translates to all members' languages.
    """
    # Gate: check chat plan
    if not await credit_service.has_chat_plan(current_user.id, db):
        raise HTTPException(
            status_code=403,
            detail="Chat plan required. Purchase the $15 lifetime chat plan to send messages.",
        )

    chat, membership = await get_chat_with_access(chat_id, current_user.id, db)
    source_lang = membership.language

    # Collect unique target languages (excluding sender's language)
    target_languages = set()
    for m in chat.members:
        if m.language != source_lang:
            target_languages.add(m.language)

    # Translate to all needed languages
    translations = {source_lang: body.content}
    for target_lang in target_languages:
        try:
            translated = await translation_service.translate(
                text=body.content,
                source_language=source_lang,
                target_language=target_lang,
            )
            translations[target_lang] = translated
        except Exception as e:
            # If translation fails, store original
            translations[target_lang] = body.content

    # Create message
    message = Message(
        chat_id=chat.id,
        sender_id=current_user.id,
        content=body.content,
        source_language=source_lang,
        message_type=body.message_type,
        translations=translations,
        reply_to_id=body.reply_to_id,
    )
    db.add(message)

    # Update chat timestamp
    chat.updated_at = datetime.utcnow()
    membership.last_read_at = datetime.utcnow()

    await db.commit()
    await db.refresh(message)

    return format_message(message, source_lang)


# ─── Group Management ──────────────────────────────────────

@router.patch("/{chat_id}")
async def update_group(
    chat_id: str,
    body: UpdateGroupRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update group chat settings (admin only)."""
    chat, membership = await get_chat_with_access(chat_id, current_user.id, db)

    if chat.chat_type != "group":
        raise HTTPException(status_code=400, detail="Can only update group chats")
    if membership.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    if body.name is not None:
        chat.name = body.name
    if body.avatar_url is not None:
        chat.avatar_url = body.avatar_url

    await db.commit()

    # Notify members about the group update
    await notify_group_update(
        chat_id=chat_id,
        event_type="group_updated",
        data={
            "chat_id": chat_id,
            "name": chat.name,
            "avatar_url": chat.avatar_url,
            "updated_by": str(current_user.id),
            "updated_by_name": current_user.display_name,
        },
        exclude_user=str(current_user.id),
    )

    return {"status": "updated"}


@router.post("/{chat_id}/members")
async def add_members(
    chat_id: str,
    body: AddMembersRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add members to a group chat."""
    chat, membership = await get_chat_with_access(chat_id, current_user.id, db)

    if chat.chat_type != "group":
        raise HTTPException(status_code=400, detail="Can only add members to groups")

    added = []
    for uid in body.user_ids:
        user_result = await db.execute(select(User).where(User.id == uid))
        user = user_result.scalar_one_or_none()
        if user:
            # Check not already member
            existing = next((m for m in chat.members if str(m.user_id) == uid), None)
            if not existing:
                db.add(ChatMember(
                    chat_id=chat.id,
                    user_id=user.id,
                    language=user.preferred_language,
                    role="member",
                ))
                added.append({"id": uid, "display_name": user.display_name})

    await db.commit()

    # Notify existing members about new members
    if added:
        await notify_group_update(
            chat_id=chat_id,
            event_type="members_added",
            data={
                "chat_id": chat_id,
                "added_members": added,
                "added_by": str(current_user.id),
                "added_by_name": current_user.display_name,
            },
        )

    return {"added": [m["id"] for m in added]}


@router.delete("/{chat_id}/members/{user_id}")
async def remove_member(
    chat_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a member from a group chat (admin or self)."""
    chat, membership = await get_chat_with_access(chat_id, current_user.id, db)

    if str(current_user.id) != user_id and membership.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only or leave yourself")

    result = await db.execute(
        select(ChatMember).where(
            ChatMember.chat_id == chat_id,
            ChatMember.user_id == user_id,
        )
    )
    target = result.scalar_one_or_none()
    removed_name = ""
    if target:
        # Get the user name before deleting
        user_result = await db.execute(select(User).where(User.id == user_id))
        removed_user = user_result.scalar_one_or_none()
        removed_name = removed_user.display_name if removed_user else ""
        await db.delete(target)
        await db.commit()

        # Notify remaining members
        is_self_leave = str(current_user.id) == user_id
        await notify_group_update(
            chat_id=chat_id,
            event_type="member_left" if is_self_leave else "member_removed",
            data={
                "chat_id": chat_id,
                "user_id": user_id,
                "display_name": removed_name,
                "removed_by": str(current_user.id) if not is_self_leave else None,
                "removed_by_name": current_user.display_name if not is_self_leave else None,
            },
        )

    return {"status": "removed"}


# ─── Set Chat Language ──────────────────────────────────────

@router.patch("/{chat_id}/language")
async def set_chat_language(
    chat_id: str,
    body: SetLanguageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Set your preferred language for this specific chat."""
    _, membership = await get_chat_with_access(chat_id, current_user.id, db)
    membership.language = body.language
    await db.commit()
    return {"status": "updated", "language": body.language}


# ─── Search Messages ────────────────────────────────────────

@router.get("/search/messages")
async def search_messages(
    q: str = Query(..., min_length=1, max_length=200),
    limit: int = Query(30, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Search messages across all chats the user is a member of.
    Searches both original content and translations.
    """
    # Get all chat IDs the user belongs to
    member_result = await db.execute(
        select(ChatMember.chat_id, ChatMember.language)
        .where(ChatMember.user_id == current_user.id)
    )
    memberships = {str(row[0]): row[1] for row in member_result.all()}

    if not memberships:
        return {"results": [], "total": 0}

    chat_ids = list(memberships.keys())

    # Search in original content and JSONB translations
    from sqlalchemy import cast, String
    results = await db.execute(
        select(Message)
        .options(selectinload(Message.sender))
        .where(
            Message.chat_id.in_(chat_ids),
            Message.is_deleted == False,
            Message.content.ilike(f"%{q}%"),
        )
        .order_by(Message.created_at.desc())
        .limit(limit)
    )
    messages = results.scalars().all()

    formatted = []
    for msg in messages:
        viewer_lang = memberships.get(str(msg.chat_id), "en")
        formatted.append({
            **format_message(msg, viewer_lang),
            "sender_username": msg.sender.username if msg.sender else "",
            "sender_display_name": msg.sender.display_name if msg.sender else "",
        })

    return {"results": formatted, "total": len(formatted)}


# ─── Leave Group ────────────────────────────────────────────

@router.post("/{chat_id}/leave")
async def leave_group(
    chat_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Leave a group chat. If the last admin leaves, promote the oldest member."""
    chat, membership = await get_chat_with_access(chat_id, current_user.id, db)

    if chat.chat_type != "group":
        raise HTTPException(status_code=400, detail="Can only leave group chats")

    is_admin = membership.role == "admin"

    # If admin leaving, check if there are other admins
    if is_admin:
        admin_result = await db.execute(
            select(ChatMember).where(
                ChatMember.chat_id == chat_id,
                ChatMember.role == "admin",
                ChatMember.user_id != current_user.id,
            )
        )
        other_admins = admin_result.scalars().all()

        if not other_admins:
            # Promote the oldest non-admin member
            member_result = await db.execute(
                select(ChatMember)
                .where(
                    ChatMember.chat_id == chat_id,
                    ChatMember.user_id != current_user.id,
                )
                .order_by(ChatMember.joined_at.asc())
                .limit(1)
            )
            new_admin = member_result.scalar_one_or_none()
            if new_admin:
                new_admin.role = "admin"

    await db.delete(membership)
    await db.commit()

    # Notify remaining members
    await notify_group_update(
        chat_id=chat_id,
        event_type="member_left",
        data={
            "chat_id": chat_id,
            "user_id": str(current_user.id),
            "display_name": current_user.display_name,
        },
    )

    return {"status": "left"}


# ─── Transfer Admin ─────────────────────────────────────────

class TransferAdminRequest(BaseModel):
    user_id: str


@router.post("/{chat_id}/transfer-admin")
async def transfer_admin(
    chat_id: str,
    body: TransferAdminRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Transfer admin role to another member."""
    chat, membership = await get_chat_with_access(chat_id, current_user.id, db)

    if chat.chat_type != "group":
        raise HTTPException(status_code=400, detail="Only for group chats")
    if membership.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    target_result = await db.execute(
        select(ChatMember).where(
            ChatMember.chat_id == chat_id,
            ChatMember.user_id == body.user_id,
        )
    )
    target = target_result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Member not found")

    target.role = "admin"
    membership.role = "member"
    await db.commit()

    # Get target user name
    user_result = await db.execute(select(User).where(User.id == body.user_id))
    target_user = user_result.scalar_one_or_none()

    await notify_group_update(
        chat_id=chat_id,
        event_type="admin_transferred",
        data={
            "chat_id": chat_id,
            "new_admin_id": body.user_id,
            "new_admin_name": target_user.display_name if target_user else "",
            "previous_admin_id": str(current_user.id),
            "previous_admin_name": current_user.display_name,
        },
    )

    return {"status": "transferred"}


# ─── Read Receipts ──────────────────────────────────────────

@router.post("/{chat_id}/read")
async def mark_chat_read(
    chat_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark all messages in a chat as read for the current user."""
    _, membership = await get_chat_with_access(chat_id, current_user.id, db)

    membership.last_read_at = datetime.utcnow()
    await db.commit()

    # Broadcast read receipt to other members viewing this chat
    await manager.broadcast_to_chat(
        chat_id,
        {
            "type": "read_receipt",
            "data": {
                "chat_id": chat_id,
                "user_id": str(current_user.id),
                "username": current_user.username,
                "read_at": membership.last_read_at.isoformat(),
            },
        },
        exclude_user=str(current_user.id),
    )

    return {"status": "read", "read_at": membership.last_read_at.isoformat()}


# ─── Export Transcript ──────────────────────────────────────

@router.get("/{chat_id}/export")
async def export_transcript(
    chat_id: str,
    format: str = Query("json", regex="^(json|txt|csv)$"),
    limit: int = Query(500, le=5000),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Export chat transcript in JSON, TXT, or CSV format.
    """
    from fastapi.responses import PlainTextResponse
    import csv
    import io
    import json as json_lib

    chat, membership = await get_chat_with_access(chat_id, current_user.id, db)

    result = await db.execute(
        select(Message)
        .options(selectinload(Message.sender))
        .where(Message.chat_id == chat_id, Message.is_deleted == False)
        .order_by(Message.created_at.asc())
        .limit(limit)
    )
    messages = result.scalars().all()

    viewer_lang = membership.language

    if format == "json":
        data = [
            {
                "id": str(m.id),
                "sender": m.sender.display_name if m.sender else "Unknown",
                "content": m.content,
                "translated": (m.translations or {}).get(viewer_lang, m.content),
                "source_language": m.source_language,
                "message_type": m.message_type,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ]
        return {
            "chat_id": chat_id,
            "chat_name": chat.name or "DM",
            "exported_at": datetime.utcnow().isoformat(),
            "message_count": len(data),
            "messages": data,
        }

    elif format == "txt":
        lines = [f"Chat export: {chat.name or 'DM'}", f"Exported at: {datetime.utcnow().isoformat()}", ""]
        for m in messages:
            name = m.sender.display_name if m.sender else "Unknown"
            ts = m.created_at.strftime("%Y-%m-%d %H:%M")
            translated = (m.translations or {}).get(viewer_lang, m.content)
            lines.append(f"[{ts}] {name}: {m.content}")
            if translated != m.content:
                lines.append(f"         → {translated}")
        return PlainTextResponse("\n".join(lines), media_type="text/plain")

    elif format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["timestamp", "sender", "content", "translated", "language", "type"])
        for m in messages:
            name = m.sender.display_name if m.sender else "Unknown"
            translated = (m.translations or {}).get(viewer_lang, m.content)
            writer.writerow([
                m.created_at.isoformat(),
                name,
                m.content,
                translated,
                m.source_language,
                m.message_type,
            ])
        return PlainTextResponse(output.getvalue(), media_type="text/csv")
