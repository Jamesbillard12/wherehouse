"""Allow containers to use QR and NFC together.

Revision ID: 0007_combined_identifier
Revises: 0006_container_identifier
"""

from alembic import op

revision = "0007_combined_identifier"
down_revision = "0006_container_identifier"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE container_identifier_type ADD VALUE IF NOT EXISTS 'both'")


def downgrade() -> None:
    # PostgreSQL enum values cannot be removed safely without rebuilding the type.
    pass
