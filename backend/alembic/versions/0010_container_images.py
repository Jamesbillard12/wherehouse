"""Add container image paths.

Revision ID: 0010_container_images
Revises: 0009_item_identifiers
"""

import sqlalchemy as sa

from alembic import op

revision = "0010_container_images"
down_revision = "0009_item_identifiers"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("containers", sa.Column("image_path", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("containers", "image_path")
