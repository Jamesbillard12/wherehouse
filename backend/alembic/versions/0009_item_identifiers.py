"""Add generated item codes and physical identifiers.

Revision ID: 0009_item_identifiers
Revises: 0008_item_images
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0009_item_identifiers"
down_revision = "0008_item_images"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE SEQUENCE item_code_number_seq START WITH 1")
    identifier_type = postgresql.ENUM(
        "none", "qr", "nfc", "both", name="item_identifier_type", create_type=False
    )
    identifier_type.create(op.get_bind(), checkfirst=True)
    op.add_column("items", sa.Column("code", sa.String(length=100), nullable=True))
    op.add_column(
        "items",
        sa.Column("identifier_type", identifier_type, server_default="none", nullable=False),
    )
    op.execute("UPDATE items SET code = 'ITM-' || LPAD(nextval('item_code_number_seq')::text, 6, '0')")
    op.alter_column("items", "code", nullable=False)
    op.create_unique_constraint("uq_item_code", "items", ["code"])


def downgrade() -> None:
    op.drop_constraint("uq_item_code", "items", type_="unique")
    op.drop_column("items", "identifier_type")
    op.drop_column("items", "code")
    op.execute("DROP TYPE IF EXISTS item_identifier_type")
    op.execute("DROP SEQUENCE IF EXISTS item_code_number_seq")
