"""Add item image paths.

Revision ID: 0008_item_images
Revises: 0007_combined_identifier
"""

import sqlalchemy as sa

from alembic import op

revision = "0008_item_images"
down_revision = "0007_combined_identifier"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("items", sa.Column("image_path", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("items", "image_path")
