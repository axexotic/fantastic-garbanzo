"""Add user preferences table.

Revision ID: 005
Revises: 004
Create Date: 2025-01-01
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_preferences",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), unique=True, nullable=False),
        # Privacy
        sa.Column("show_last_seen", sa.String(20), server_default="everyone"),
        sa.Column("show_profile_photo", sa.String(20), server_default="everyone"),
        sa.Column("show_read_receipts", sa.Boolean(), server_default="true"),
        sa.Column("two_factor_enabled", sa.Boolean(), server_default="false"),
        sa.Column("active_sessions_limit", sa.Integer(), server_default="5"),
        # Chat Settings
        sa.Column("chat_font_size", sa.String(10), server_default="medium"),
        sa.Column("chat_wallpaper", sa.String(100), server_default="default"),
        sa.Column("message_grouping", sa.Boolean(), server_default="true"),
        sa.Column("send_with_enter", sa.Boolean(), server_default="true"),
        sa.Column("auto_translate_messages", sa.Boolean(), server_default="true"),
        # Advanced
        sa.Column("auto_download_media", sa.Boolean(), server_default="true"),
        sa.Column("auto_download_max_size_mb", sa.Integer(), server_default="10"),
        sa.Column("data_saver_mode", sa.Boolean(), server_default="false"),
        sa.Column("proxy_enabled", sa.Boolean(), server_default="false"),
        # Battery & Animations
        sa.Column("reduce_animations", sa.Boolean(), server_default="false"),
        sa.Column("power_saving_mode", sa.Boolean(), server_default="false"),
        sa.Column("auto_play_gifs", sa.Boolean(), server_default="true"),
        # Speakers & Camera defaults
        sa.Column("preferred_audio_input", sa.String(255), server_default=""),
        sa.Column("preferred_audio_output", sa.String(255), server_default=""),
        sa.Column("preferred_video_input", sa.String(255), server_default=""),
        sa.Column("echo_cancellation", sa.Boolean(), server_default="true"),
        sa.Column("noise_suppression", sa.Boolean(), server_default="true"),
        sa.Column("auto_gain_control", sa.Boolean(), server_default="true"),
        # Timestamps
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_user_preferences_user_id", "user_preferences", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_user_preferences_user_id", table_name="user_preferences")
    op.drop_table("user_preferences")
