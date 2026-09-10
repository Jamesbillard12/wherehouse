"""Add borrower identity, invitations, and checkouts.

Revision ID: 0015_borrowers_checkouts
Revises: 0014_identifier_replacement
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0015_borrowers_checkouts"
down_revision = "0014_identifier_replacement"
branch_labels = None
depends_on = None


def upgrade() -> None:
    uuid = postgresql.UUID(as_uuid=True)

    def timestamps():
        return [
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
        ]

    op.create_table(
        "borrower_profiles",
        sa.Column("id", uuid, primary_key=True),
        sa.Column(
            "workspace_id", uuid, sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("display_name", sa.String(200), nullable=False),
        sa.Column("email", sa.String(320)),
        sa.Column("linked_user_id", uuid, sa.ForeignKey("users.id", ondelete="RESTRICT")),
        sa.Column(
            "created_by_user_id",
            uuid,
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        *timestamps(),
        sa.UniqueConstraint("workspace_id", "linked_user_id", name="uq_borrower_linked_user"),
    )
    op.create_index("ix_borrower_profiles_workspace_id", "borrower_profiles", ["workspace_id"])
    op.create_table(
        "borrower_invitations",
        sa.Column("id", uuid, primary_key=True),
        sa.Column(
            "workspace_id", uuid, sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "borrower_profile_id",
            uuid,
            sa.ForeignKey("borrower_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("invited_email", sa.String(320), nullable=False),
        sa.Column("token_hash", sa.String(64), unique=True, nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_by_user_id",
            uuid,
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("consumed_at", sa.DateTime(timezone=True)),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        *timestamps(),
    )
    op.create_index(
        "ix_borrower_invitations_workspace_id", "borrower_invitations", ["workspace_id"]
    )
    op.create_index(
        "ix_borrower_invitations_borrower_profile_id",
        "borrower_invitations",
        ["borrower_profile_id"],
    )
    op.create_index(
        "uq_borrower_invitation_open",
        "borrower_invitations",
        ["borrower_profile_id"],
        unique=True,
        postgresql_where=sa.text("consumed_at IS NULL AND revoked_at IS NULL"),
    )
    op.create_table(
        "checkouts",
        sa.Column("id", uuid, primary_key=True),
        sa.Column(
            "workspace_id", uuid, sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("item_id", uuid, sa.ForeignKey("items.id", ondelete="RESTRICT"), nullable=False),
        sa.Column(
            "borrower_profile_id",
            uuid,
            sa.ForeignKey("borrower_profiles.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("checked_out_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True)),
        sa.Column("returned_at", sa.DateTime(timezone=True)),
        sa.Column("checkout_notes", sa.Text()),
        sa.Column("return_notes", sa.Text()),
        sa.Column(
            "checked_out_by_user_id",
            uuid,
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("returned_by_user_id", uuid, sa.ForeignKey("users.id", ondelete="RESTRICT")),
        *timestamps(),
    )
    for column in ("workspace_id", "item_id", "borrower_profile_id"):
        op.create_index(f"ix_checkouts_{column}", "checkouts", [column])
    op.create_index(
        "uq_checkout_active_item",
        "checkouts",
        ["item_id"],
        unique=True,
        postgresql_where=sa.text("returned_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_table("checkouts")
    op.drop_table("borrower_invitations")
    op.drop_table("borrower_profiles")
