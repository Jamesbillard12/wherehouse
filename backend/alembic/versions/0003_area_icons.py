"""Add selectable icons to areas.

Revision ID: 0003_area_icons
Revises: 0002_auth_devices_pairing
"""

import sqlalchemy as sa

from alembic import op

revision = "0003_area_icons"
down_revision = "0002_auth_devices_pairing"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "areas",
        sa.Column("icon", sa.String(length=50), server_default="warehouse", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("areas", "icon")
