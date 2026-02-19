"""Initial schema - baseline for all tables created directly."""
from alembic import op


def upgrade():
    """Empty upgrade - all tables created via Base.metadata.create_all()."""
    pass


def downgrade():
    """Empty downgrade."""
    pass
