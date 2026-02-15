"""webhooks_notifications_preferences

Revision ID: 003
Revises: 002
Create Date: 2025-01-01

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "003"
down_revision = "002_subscriptions_recording"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Webhook configs
    op.create_table(
        "webhook_configs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("webhook_url", sa.String(1000), nullable=False),
        sa.Column("events", postgresql.ARRAY(sa.String), default=[]),
        sa.Column("is_active", sa.Boolean, default=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    # Notification preferences
    op.create_table(
        "notification_preferences",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), unique=True, nullable=False),
        sa.Column("email_messages", sa.Boolean, default=False),
        sa.Column("email_calls", sa.Boolean, default=True),
        sa.Column("email_friend_requests", sa.Boolean, default=True),
        sa.Column("push_messages", sa.Boolean, default=True),
        sa.Column("push_calls", sa.Boolean, default=True),
        sa.Column("push_friend_requests", sa.Boolean, default=True),
        sa.Column("sound_enabled", sa.Boolean, default=True),
        sa.Column("dnd_enabled", sa.Boolean, default=False),
        sa.Column("dnd_start", sa.String(5), default="22:00"),
        sa.Column("dnd_end", sa.String(5), default="08:00"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("notification_preferences")
    op.drop_table("webhook_configs")
