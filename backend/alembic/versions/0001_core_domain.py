"""Create the initial WhereHouse core domain.

Revision ID: 0001_core_domain
Revises:
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_core_domain"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    household_relationship = postgresql.ENUM(
        "owner", "borrower", name="household_relationship", create_type=False
    )
    container_type = postgresql.ENUM(
        "bin",
        "box",
        "shelf",
        "shelving_unit",
        "cabinet",
        "drawer",
        "toolbox",
        "bag",
        "case",
        "rack",
        "hook",
        "workbench",
        "other",
        name="container_type",
        create_type=False,
    )
    container_relationship = postgresql.ENUM(
        "in", "on", "under", "attached_to", name="container_relationship", create_type=False
    )
    item_container_relationship = postgresql.ENUM(
        "in", "on", "under", "attached_to", name="item_container_relationship", create_type=False
    )

    bind = op.get_bind()
    household_relationship.create(bind, checkfirst=True)
    container_type.create(bind, checkfirst=True)
    container_relationship.create(bind, checkfirst=True)
    item_container_relationship.create(bind, checkfirst=True)

    op.create_table(
        "households",
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "users",
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("display_name", sa.String(length=200), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=False)

    op.create_table(
        "household_users",
        sa.Column("household_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("relationship_type", household_relationship, nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("household_id", "user_id", name="uq_household_user"),
    )

    op.create_table(
        "areas",
        sa.Column("household_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("household_id", "name", name="uq_area_household_name"),
    )

    op.create_table(
        "zones",
        sa.Column("area_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["area_id"], ["areas.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("area_id", "name", name="uq_zone_area_name"),
    )

    op.create_table(
        "containers",
        sa.Column("area_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("zone_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("code", sa.String(length=100), nullable=True),
        sa.Column("container_type", container_type, nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_movable", sa.Boolean(), nullable=False),
        sa.Column("is_out_of_space", sa.Boolean(), nullable=False),
        sa.Column("is_archived", sa.Boolean(), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["area_id"], ["areas.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["zone_id"], ["zones.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_containers_area_id", "containers", ["area_id"], unique=False)
    op.create_index("ix_containers_zone_id", "containers", ["zone_id"], unique=False)

    op.create_table(
        "container_placements",
        sa.Column("container_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("parent_container_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("relationship_type", container_relationship, nullable=False),
        sa.Column("position", sa.Integer(), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("container_id <> parent_container_id", name="ck_container_not_own_parent"),
        sa.ForeignKeyConstraint(["container_id"], ["containers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["parent_container_id"], ["containers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("container_id", name="uq_container_active_placement"),
    )

    op.create_table(
        "items",
        sa.Column("household_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=300), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("quantity", sa.Numeric(precision=12, scale=3), nullable=False),
        sa.Column("unit", sa.String(length=50), nullable=True),
        sa.Column("manufacturer", sa.String(length=200), nullable=True),
        sa.Column("model", sa.String(length=200), nullable=True),
        sa.Column("serial_number", sa.String(length=300), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_archived", sa.Boolean(), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_items_household_id", "items", ["household_id"], unique=False)

    op.create_table(
        "item_placements",
        sa.Column("item_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("area_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("zone_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("container_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("relationship_type", item_container_relationship, nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "((area_id IS NOT NULL)::int + (zone_id IS NOT NULL)::int + "
            "(container_id IS NOT NULL)::int) = 1",
            name="ck_item_placement_one_target",
        ),
        sa.ForeignKeyConstraint(["area_id"], ["areas.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["container_id"], ["containers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["item_id"], ["items.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["zone_id"], ["zones.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("item_id", name="uq_item_active_placement"),
    )


def downgrade() -> None:
    op.drop_table("item_placements")
    op.drop_index("ix_items_household_id", table_name="items")
    op.drop_table("items")
    op.drop_table("container_placements")
    op.drop_index("ix_containers_zone_id", table_name="containers")
    op.drop_index("ix_containers_area_id", table_name="containers")
    op.drop_table("containers")
    op.drop_table("zones")
    op.drop_table("areas")
    op.drop_table("household_users")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
    op.drop_table("households")
    op.execute("DROP TYPE IF EXISTS item_container_relationship")
    op.execute("DROP TYPE IF EXISTS container_relationship")
    op.execute("DROP TYPE IF EXISTS container_type")
    op.execute("DROP TYPE IF EXISTS household_relationship")
