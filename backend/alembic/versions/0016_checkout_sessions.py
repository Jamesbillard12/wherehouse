"""Add persistent multi-item checkout sessions.

Revision ID: 0016_checkout_sessions
Revises: 0015_borrowers_checkouts
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0016_checkout_sessions"
down_revision = "0015_borrowers_checkouts"
branch_labels = None
depends_on = None


def timestamps():
    return [
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    ]


def upgrade() -> None:
    uuid = postgresql.UUID(as_uuid=True)
    status = postgresql.ENUM(
        "active", "completed", "abandoned", name="checkout_session_status", create_type=False
    )
    status.create(op.get_bind())
    op.create_table(
        "checkout_sessions",
        sa.Column("id", uuid, primary_key=True),
        sa.Column(
            "workspace_id", uuid, sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "actor_user_id", uuid, sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
        ),
        sa.Column(
            "borrower_profile_id", uuid, sa.ForeignKey("borrower_profiles.id", ondelete="RESTRICT")
        ),
        sa.Column("due_at", sa.DateTime(timezone=True)),
        sa.Column("note", sa.Text()),
        sa.Column("status", status, nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("abandoned_at", sa.DateTime(timezone=True)),
        *timestamps(),
    )
    op.create_index("ix_checkout_sessions_workspace_id", "checkout_sessions", ["workspace_id"])
    op.create_index("ix_checkout_sessions_actor_user_id", "checkout_sessions", ["actor_user_id"])
    op.create_index(
        "uq_checkout_session_active_actor",
        "checkout_sessions",
        ["workspace_id", "actor_user_id"],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
    )
    op.create_table(
        "checkout_session_items",
        sa.Column("id", uuid, primary_key=True),
        sa.Column(
            "checkout_session_id",
            uuid,
            sa.ForeignKey("checkout_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("item_id", uuid, sa.ForeignKey("items.id", ondelete="RESTRICT"), nullable=False),
        sa.Column(
            "added_by_user_id", uuid, sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
        ),
        sa.Column("added_by_device_id", uuid, sa.ForeignKey("devices.id", ondelete="SET NULL")),
        sa.Column("added_at", sa.DateTime(timezone=True), nullable=False),
        *timestamps(),
        sa.UniqueConstraint("checkout_session_id", "item_id", name="uq_checkout_session_item"),
    )
    op.create_index(
        "ix_checkout_session_items_checkout_session_id",
        "checkout_session_items",
        ["checkout_session_id"],
    )
    op.create_index("ix_checkout_session_items_item_id", "checkout_session_items", ["item_id"])


def downgrade() -> None:
    op.drop_table("checkout_session_items")
    op.drop_table("checkout_sessions")
    postgresql.ENUM(name="checkout_session_status", create_type=False).drop(op.get_bind())
