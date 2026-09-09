"""Allow safe physical identifier replacement.

Revision ID: 0014_identifier_replacement
Revises: 0013_workspace_model
"""
import sqlalchemy as sa

from alembic import op

revision = "0014_identifier_replacement"
down_revision = "0013_workspace_model"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index("uq_physical_identifier_active_target_medium", table_name="physical_identifiers")
    op.create_index(
        "uq_physical_identifier_pending_target_medium",
        "physical_identifiers",
        ["target_type", "target_id", "medium"],
        unique=True,
        postgresql_where=sa.text("status = 'pending'"),
    )
    op.create_index(
        "uq_physical_identifier_active_target_medium",
        "physical_identifiers",
        ["target_type", "target_id", "medium"],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
    )


def downgrade() -> None:
    op.drop_index("uq_physical_identifier_active_target_medium", table_name="physical_identifiers")
    op.drop_index("uq_physical_identifier_pending_target_medium", table_name="physical_identifiers")
    op.execute(
        """
        UPDATE physical_identifiers AS pending
        SET status = 'revoked'
        WHERE pending.status = 'pending'
          AND EXISTS (
            SELECT 1 FROM physical_identifiers AS active
            WHERE active.target_type = pending.target_type
              AND active.target_id = pending.target_id
              AND active.medium = pending.medium
              AND active.status = 'active'
          )
        """
    )
    op.create_index(
        "uq_physical_identifier_active_target_medium",
        "physical_identifiers",
        ["target_type", "target_id", "medium"],
        unique=True,
        postgresql_where=sa.text("status IN ('pending', 'active')"),
    )
