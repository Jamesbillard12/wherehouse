"""Require globally unique container codes.

Revision ID: 0004_container_codes
Revises: 0003_area_icons
"""

import sqlalchemy as sa

from alembic import op

revision = "0004_container_codes"
down_revision = "0003_area_icons"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "UPDATE containers "
        "SET code = 'WH-' || UPPER(SUBSTRING(REPLACE(id::text, '-', ''), 1, 12)) "
        "WHERE code IS NULL OR BTRIM(code) = ''"
    )
    op.execute("UPDATE containers SET code = UPPER(BTRIM(code))")
    op.execute(
        "WITH ranked AS ("
        "SELECT id, ROW_NUMBER() OVER (PARTITION BY code ORDER BY id) AS occurrence "
        "FROM containers"
        ") "
        "UPDATE containers AS container "
        "SET code = 'WH-' || UPPER(SUBSTRING(REPLACE(container.id::text, '-', ''), 1, 12)) "
        "FROM ranked "
        "WHERE container.id = ranked.id AND ranked.occurrence > 1"
    )
    op.alter_column("containers", "code", existing_type=sa.String(length=100), nullable=False)
    op.create_unique_constraint("uq_container_code", "containers", ["code"])


def downgrade() -> None:
    op.drop_constraint("uq_container_code", "containers", type_="unique")
    op.alter_column("containers", "code", existing_type=sa.String(length=100), nullable=True)
