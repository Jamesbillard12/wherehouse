"""Add container identification method.

Revision ID: 0006_container_identifier
Revises: 0005_generated_codes
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0006_container_identifier"
down_revision = "0005_generated_codes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    identifier_type = postgresql.ENUM(
        "none", "qr", "nfc", name="container_identifier_type", create_type=False
    )
    identifier_type.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "containers",
        sa.Column(
            "identifier_type",
            identifier_type,
            server_default="none",
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("containers", "identifier_type")
    op.execute("DROP TYPE IF EXISTS container_identifier_type")
