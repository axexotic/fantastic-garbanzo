"""add subscriptions and call recording

Revision ID: 002_subscriptions_recording
Revises:
Create Date: 2024-01-15 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers
revision: str = "002_subscriptions_recording"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create subscriptions table
    op.create_table(
        "subscriptions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), unique=True, nullable=False),
        sa.Column("stripe_customer_id", sa.String(255), unique=True),
        sa.Column("stripe_subscription_id", sa.String(255), unique=True),
        sa.Column("plan", sa.String(50), server_default="free"),
        sa.Column("status", sa.String(50), server_default="active"),
        sa.Column("current_period_start", sa.DateTime),
        sa.Column("current_period_end", sa.DateTime),
        sa.Column("cancel_at_period_end", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    # Add recording columns to calls table
    op.add_column("calls", sa.Column("is_recorded", sa.Boolean, server_default="false"))
    op.add_column("calls", sa.Column("recording_url", sa.String(500)))
    op.add_column("calls", sa.Column("recording_s3_key", sa.String(500)))
    op.add_column("calls", sa.Column("recording_size_bytes", sa.Integer))
    op.add_column("calls", sa.Column("recording_duration_seconds", sa.Float))


def downgrade() -> None:
    op.drop_column("calls", "recording_duration_seconds")
    op.drop_column("calls", "recording_size_bytes")
    op.drop_column("calls", "recording_s3_key")
    op.drop_column("calls", "recording_url")
    op.drop_column("calls", "recording_url")
    op.drop_column("calls", "is_recorded")
    op.drop_table("subscriptions")
