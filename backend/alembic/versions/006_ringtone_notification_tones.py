"""Add ringtone, notification_tone, group_tone and vibration to notification_preferences.

Revision ID: 006
Revises: 005
Create Date: 2025-01-01
"""

from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "notification_preferences",
        sa.Column("ringtone", sa.String(50), server_default="default"),
    )
    op.add_column(
        "notification_preferences",
        sa.Column("notification_tone", sa.String(50), server_default="default"),
    )
    op.add_column(
        "notification_preferences",
        sa.Column("group_tone", sa.String(50), server_default="default"),
    )
    op.add_column(
        "notification_preferences",
        sa.Column("vibration_enabled", sa.Boolean(), server_default="true"),
    )


def downgrade() -> None:
    op.drop_column("notification_preferences", "vibration_enabled")
    op.drop_column("notification_preferences", "group_tone")
    op.drop_column("notification_preferences", "notification_tone")
    op.drop_column("notification_preferences", "ringtone")
