"""Generalize households into typed workspaces.

Revision ID: 0013_workspace_model
Revises: 0012_item_creation_idempotency
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0013_workspace_model"
down_revision = "0012_item_creation_idempotency"
branch_labels = None
depends_on = None


DIRECTLY_SCOPED_TABLES = (
    "areas",
    "items",
    "physical_identifiers",
    "app_instances",
    "devices",
    "pairing_sessions",
)


def upgrade() -> None:
    bind = op.get_bind()
    workspace_type = postgresql.ENUM(
        "household", name="workspace_type", create_type=False
    )
    workspace_type.create(bind, checkfirst=True)

    op.rename_table("households", "workspaces")
    op.add_column(
        "workspaces",
        sa.Column(
            "workspace_type",
            workspace_type,
            nullable=False,
            server_default="household",
        ),
    )
    op.rename_table("household_users", "workspace_memberships")
    op.alter_column("workspace_memberships", "household_id", new_column_name="workspace_id")
    op.alter_column("workspace_memberships", "relationship_type", new_column_name="role")
    op.execute("ALTER TYPE household_relationship RENAME TO workspace_role")

    for table in DIRECTLY_SCOPED_TABLES:
        op.alter_column(table, "household_id", new_column_name="workspace_id")

    op.execute(
        "ALTER TABLE workspace_memberships RENAME CONSTRAINT "
        "uq_household_user TO uq_workspace_membership"
    )
    op.execute(
        "ALTER TABLE workspace_memberships RENAME CONSTRAINT "
        "household_users_household_id_fkey TO workspace_memberships_workspace_id_fkey"
    )
    for table in DIRECTLY_SCOPED_TABLES:
        op.execute(
            f"ALTER TABLE {table} RENAME CONSTRAINT "
            f"{table}_household_id_fkey TO {table}_workspace_id_fkey"
        )
    op.execute(
        "ALTER TABLE areas RENAME CONSTRAINT "
        "uq_area_household_name TO uq_area_workspace_name"
    )
    op.execute(
        "ALTER TABLE app_instances RENAME CONSTRAINT "
        "uq_app_instance_household TO uq_app_instance_workspace"
    )
    op.execute(
        "ALTER TABLE items RENAME CONSTRAINT "
        "uq_item_household_creation_operation TO uq_item_workspace_creation_operation"
    )
    op.execute("ALTER INDEX ix_items_household_id RENAME TO ix_items_workspace_id")
    op.execute("ALTER INDEX ix_devices_household_active RENAME TO ix_devices_workspace_active")
    op.execute(
        "ALTER INDEX ix_physical_identifiers_household_id "
        "RENAME TO ix_physical_identifiers_workspace_id"
    )


def downgrade() -> None:
    op.execute(
        "ALTER INDEX ix_physical_identifiers_workspace_id "
        "RENAME TO ix_physical_identifiers_household_id"
    )
    op.execute("ALTER INDEX ix_devices_workspace_active RENAME TO ix_devices_household_active")
    op.execute("ALTER INDEX ix_items_workspace_id RENAME TO ix_items_household_id")
    op.execute(
        "ALTER TABLE items RENAME CONSTRAINT "
        "uq_item_workspace_creation_operation TO uq_item_household_creation_operation"
    )
    op.execute(
        "ALTER TABLE app_instances RENAME CONSTRAINT "
        "uq_app_instance_workspace TO uq_app_instance_household"
    )
    op.execute(
        "ALTER TABLE areas RENAME CONSTRAINT "
        "uq_area_workspace_name TO uq_area_household_name"
    )
    op.execute(
        "ALTER TABLE workspace_memberships RENAME CONSTRAINT "
        "uq_workspace_membership TO uq_household_user"
    )
    for table in DIRECTLY_SCOPED_TABLES:
        op.execute(
            f"ALTER TABLE {table} RENAME CONSTRAINT "
            f"{table}_workspace_id_fkey TO {table}_household_id_fkey"
        )
    op.execute(
        "ALTER TABLE workspace_memberships RENAME CONSTRAINT "
        "workspace_memberships_workspace_id_fkey TO household_users_household_id_fkey"
    )

    for table in reversed(DIRECTLY_SCOPED_TABLES):
        op.alter_column(table, "workspace_id", new_column_name="household_id")

    op.execute("ALTER TYPE workspace_role RENAME TO household_relationship")
    op.alter_column("workspace_memberships", "role", new_column_name="relationship_type")
    op.alter_column("workspace_memberships", "workspace_id", new_column_name="household_id")
    op.rename_table("workspace_memberships", "household_users")
    op.drop_column("workspaces", "workspace_type")
    op.rename_table("workspaces", "households")
    postgresql.ENUM(name="workspace_type").drop(op.get_bind(), checkfirst=True)
