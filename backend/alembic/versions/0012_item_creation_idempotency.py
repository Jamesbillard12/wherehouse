"""Add idempotency metadata for item creation.

Revision ID: 0012_item_creation_idempotency
Revises: 0011_physical_identifiers
"""
import sqlalchemy as sa
from alembic import op

revision = "0012_item_creation_idempotency"
down_revision = "0011_physical_identifiers"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("items", sa.Column("creation_operation_id", sa.String(100), nullable=True))
    op.add_column("items", sa.Column("creation_payload_hash", sa.String(64), nullable=True))
    op.create_unique_constraint(
        "uq_item_household_creation_operation",
        "items",
        ["household_id", "creation_operation_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_item_household_creation_operation", "items", type_="unique")
    op.drop_column("items", "creation_payload_hash")
    op.drop_column("items", "creation_operation_id")
