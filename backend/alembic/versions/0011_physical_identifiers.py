"""Add reusable physical identifiers.

Revision ID: 0011_physical_identifiers
Revises: 0010_container_images
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0011_physical_identifiers"
down_revision = "0010_container_images"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    for name, values in (
        ("identifier_target_type", ("item", "container")),
        ("identifier_medium", ("qr", "nfc")),
        ("identifier_status", ("pending", "active", "revoked")),
    ):
        postgresql.ENUM(*values, name=name).create(bind, checkfirst=True)
    op.create_table(
        "physical_identifiers",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("household_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("public_id", sa.String(64), nullable=False),
        sa.Column("target_type", postgresql.ENUM("item", "container", name="identifier_target_type", create_type=False), nullable=False),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("medium", postgresql.ENUM("qr", "nfc", name="identifier_medium", create_type=False), nullable=False),
        sa.Column("status", postgresql.ENUM("pending", "active", "revoked", name="identifier_status", create_type=False), nullable=False),
        sa.Column("payload_version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("public_id", name="uq_physical_identifier_public_id"),
    )
    op.create_index("ix_physical_identifiers_household_id", "physical_identifiers", ["household_id"])
    op.create_index("ix_physical_identifiers_public_id", "physical_identifiers", ["public_id"])
    op.create_index("ix_physical_identifiers_target_id", "physical_identifiers", ["target_id"])
    op.create_index(
        "uq_physical_identifier_active_target_medium", "physical_identifiers",
        ["target_type", "target_id", "medium"], unique=True,
        postgresql_where=sa.text("status IN ('pending', 'active')"),
    )


def downgrade() -> None:
    op.drop_table("physical_identifiers")
    for name in ("identifier_status", "identifier_medium", "identifier_target_type"):
        op.execute(f"DROP TYPE IF EXISTS {name}")
