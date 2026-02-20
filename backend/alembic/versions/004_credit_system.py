"""004 — Replace subscriptions with credit system.

Drop subscriptions table. Create credit_balances (with chat_plan_purchased) + credit_transactions.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "004"
down_revision = "003_webhooks_notifications"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop old subscriptions table
    op.drop_table("subscriptions")

    # Create credit_balances
    op.create_table(
        "credit_balances",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), unique=True, nullable=False),
        sa.Column("stripe_customer_id", sa.String(255), unique=True),
        sa.Column("chat_plan_purchased", sa.Boolean(), server_default="false"),
        sa.Column("balance_cents", sa.Integer(), server_default="0"),
        sa.Column("total_purchased_cents", sa.Integer(), server_default="0"),
        sa.Column("total_used_cents", sa.Integer(), server_default="0"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # Create credit_transactions
    op.create_table(
        "credit_transactions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("credit_balance_id", UUID(as_uuid=True), sa.ForeignKey("credit_balances.id"), nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("transaction_type", sa.String(50), nullable=False),
        sa.Column("description", sa.String(500), server_default=""),
        sa.Column("stripe_payment_intent_id", sa.String(255)),
        sa.Column("metadata_json", JSONB, server_default="{}"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # Index for fast transaction lookups
    op.create_index("ix_credit_transactions_balance_id", "credit_transactions", ["credit_balance_id"])
    op.create_index("ix_credit_transactions_type", "credit_transactions", ["transaction_type"])


def downgrade() -> None:
    op.drop_index("ix_credit_transactions_type", "credit_transactions")
    op.drop_index("ix_credit_transactions_balance_id", "credit_transactions")
    op.drop_table("credit_transactions")
    op.drop_table("credit_balances")

    # Recreate subscriptions table
    op.create_table(
        "subscriptions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), unique=True, nullable=False),
        sa.Column("stripe_customer_id", sa.String(255), unique=True),
        sa.Column("stripe_subscription_id", sa.String(255), unique=True),
        sa.Column("plan", sa.String(50), server_default="free"),
        sa.Column("status", sa.String(50), server_default="active"),
        sa.Column("current_period_start", sa.DateTime()),
        sa.Column("current_period_end", sa.DateTime()),
        sa.Column("cancel_at_period_end", sa.Boolean(), server_default="false"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )
