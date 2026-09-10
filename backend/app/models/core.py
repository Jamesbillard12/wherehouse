from __future__ import annotations

import enum
from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


def enum_values(enum_cls: type[enum.Enum]) -> list[str]:
    return [member.value for member in enum_cls]


class WorkspaceRole(str, enum.Enum):
    OWNER = "owner"
    BORROWER = "borrower"


class WorkspaceType(str, enum.Enum):
    HOUSEHOLD = "household"


class ContainerRelationship(str, enum.Enum):
    IN = "in"
    ON = "on"
    UNDER = "under"
    ATTACHED_TO = "attached_to"


class ContainerType(str, enum.Enum):
    BIN = "bin"
    BOX = "box"
    SHELF = "shelf"
    SHELVING_UNIT = "shelving_unit"
    CABINET = "cabinet"
    DRAWER = "drawer"
    TOOLBOX = "toolbox"
    BAG = "bag"
    CASE = "case"
    RACK = "rack"
    HOOK = "hook"
    WORKBENCH = "workbench"
    OTHER = "other"


class ContainerIdentifierType(str, enum.Enum):
    NONE = "none"
    QR = "qr"
    NFC = "nfc"
    BOTH = "both"


class ItemIdentifierType(str, enum.Enum):
    NONE = "none"
    QR = "qr"
    NFC = "nfc"
    BOTH = "both"


class IdentifierTargetType(str, enum.Enum):
    ITEM = "item"
    CONTAINER = "container"


class IdentifierMedium(str, enum.Enum):
    QR = "qr"
    NFC = "nfc"


class IdentifierStatus(str, enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    REVOKED = "revoked"


class Workspace(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "workspaces"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    workspace_type: Mapped[WorkspaceType] = mapped_column(
        Enum(WorkspaceType, name="workspace_type", values_callable=enum_values),
        nullable=False,
        default=WorkspaceType.HOUSEHOLD,
    )

    users: Mapped[list[WorkspaceMembership]] = relationship(back_populates="workspace")
    areas: Mapped[list[Area]] = relationship(back_populates="workspace")


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)

    workspaces: Mapped[list[WorkspaceMembership]] = relationship(back_populates="user")


class WorkspaceMembership(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "workspace_memberships"
    __table_args__ = (UniqueConstraint("workspace_id", "user_id", name="uq_workspace_membership"),)

    workspace_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[WorkspaceRole] = mapped_column(
        Enum(
            WorkspaceRole,
            name="workspace_role",
            values_callable=enum_values,
        ),
        nullable=False,
    )

    workspace: Mapped[Workspace] = relationship(back_populates="users")
    user: Mapped[User] = relationship(back_populates="workspaces")


class Area(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "areas"
    __table_args__ = (UniqueConstraint("workspace_id", "name", name="uq_area_workspace_name"),)

    workspace_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    icon: Mapped[str] = mapped_column(String(50), nullable=False, default="warehouse")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    workspace: Mapped[Workspace] = relationship(back_populates="areas")
    zones: Mapped[list[Zone]] = relationship(back_populates="area")
    containers: Mapped[list[Container]] = relationship(back_populates="area")


class Zone(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "zones"
    __table_args__ = (UniqueConstraint("area_id", "name", name="uq_zone_area_name"),)

    area_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("areas.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    area: Mapped[Area] = relationship(back_populates="zones")
    containers: Mapped[list[Container]] = relationship(back_populates="zone")


class Container(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "containers"
    __table_args__ = (UniqueConstraint("code", name="uq_container_code"),)

    area_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("areas.id", ondelete="CASCADE"), nullable=False, index=True
    )
    zone_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("zones.id", ondelete="SET NULL"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(100), nullable=False)
    container_type: Mapped[ContainerType] = mapped_column(
        Enum(ContainerType, name="container_type", values_callable=enum_values), nullable=False
    )
    identifier_type: Mapped[ContainerIdentifierType] = mapped_column(
        Enum(
            ContainerIdentifierType,
            name="container_identifier_type",
            values_callable=enum_values,
        ),
        nullable=False,
        default=ContainerIdentifierType.NONE,
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_movable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_out_of_space: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    area: Mapped[Area] = relationship(back_populates="containers")
    zone: Mapped[Zone | None] = relationship(back_populates="containers")


class ContainerPlacement(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "container_placements"
    __table_args__ = (
        UniqueConstraint("container_id", name="uq_container_active_placement"),
        CheckConstraint("container_id <> parent_container_id", name="ck_container_not_own_parent"),
    )

    container_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("containers.id", ondelete="CASCADE"), nullable=False
    )
    parent_container_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("containers.id", ondelete="CASCADE"), nullable=False
    )
    relationship_type: Mapped[ContainerRelationship] = mapped_column(
        Enum(
            ContainerRelationship,
            name="container_relationship",
            values_callable=enum_values,
        ),
        nullable=False,
    )
    position: Mapped[int | None] = mapped_column(nullable=True)

    container: Mapped[Container] = relationship(foreign_keys=[container_id])
    parent_container: Mapped[Container] = relationship(foreign_keys=[parent_container_id])


class Item(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "items"
    __table_args__ = (
        UniqueConstraint("code", name="uq_item_code"),
        UniqueConstraint(
            "workspace_id",
            "creation_operation_id",
            name="uq_item_workspace_creation_operation",
        ),
    )

    workspace_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    code: Mapped[str] = mapped_column(String(100), nullable=False)
    identifier_type: Mapped[ItemIdentifierType] = mapped_column(
        Enum(ItemIdentifierType, name="item_identifier_type", values_callable=enum_values),
        nullable=False,
        default=ItemIdentifierType.NONE,
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False, default=1)
    unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    manufacturer: Mapped[str | None] = mapped_column(String(200), nullable=True)
    model: Mapped[str | None] = mapped_column(String(200), nullable=True)
    serial_number: Mapped[str | None] = mapped_column(String(300), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    creation_operation_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    creation_payload_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)


class ItemPlacement(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "item_placements"
    __table_args__ = (
        UniqueConstraint("item_id", name="uq_item_active_placement"),
        CheckConstraint(
            "((area_id IS NOT NULL)::int + (zone_id IS NOT NULL)::int + "
            "(container_id IS NOT NULL)::int) = 1",
            name="ck_item_placement_one_target",
        ),
    )

    item_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("items.id", ondelete="CASCADE"), nullable=False
    )
    area_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("areas.id", ondelete="CASCADE"), nullable=True
    )
    zone_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("zones.id", ondelete="CASCADE"), nullable=True
    )
    container_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("containers.id", ondelete="CASCADE"), nullable=True
    )
    relationship_type: Mapped[ContainerRelationship | None] = mapped_column(
        Enum(
            ContainerRelationship,
            name="item_container_relationship",
            values_callable=enum_values,
        ),
        nullable=True,
    )

    item: Mapped[Item] = relationship()
    area: Mapped[Area | None] = relationship()
    zone: Mapped[Zone | None] = relationship()
    container: Mapped[Container | None] = relationship()


class PhysicalIdentifier(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "physical_identifiers"
    __table_args__ = (UniqueConstraint("public_id", name="uq_physical_identifier_public_id"),)

    workspace_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    public_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    target_type: Mapped[IdentifierTargetType] = mapped_column(
        Enum(IdentifierTargetType, name="identifier_target_type", values_callable=enum_values),
        nullable=False,
    )
    target_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    medium: Mapped[IdentifierMedium] = mapped_column(
        Enum(IdentifierMedium, name="identifier_medium", values_callable=enum_values),
        nullable=False,
    )
    status: Mapped[IdentifierStatus] = mapped_column(
        Enum(IdentifierStatus, name="identifier_status", values_callable=enum_values),
        nullable=False,
        default=IdentifierStatus.PENDING,
    )
    payload_version: Mapped[int] = mapped_column(nullable=False, default=1)


class BorrowerProfile(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "borrower_profiles"
    __table_args__ = (
        UniqueConstraint("workspace_id", "linked_user_id", name="uq_borrower_linked_user"),
    )

    workspace_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    linked_user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=True
    )
    created_by_user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )


class BorrowerInvitation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "borrower_invitations"
    __table_args__ = (
        Index(
            "uq_borrower_invitation_open",
            "borrower_profile_id",
            unique=True,
            postgresql_where=text("consumed_at IS NULL AND revoked_at IS NULL"),
        ),
    )

    workspace_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    borrower_profile_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("borrower_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    invited_email: Mapped[str] = mapped_column(String(320), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_by_user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Checkout(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "checkouts"
    __table_args__ = (
        Index(
            "uq_checkout_active_item",
            "item_id",
            unique=True,
            postgresql_where=text("returned_at IS NULL"),
        ),
    )

    workspace_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    item_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("items.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    borrower_profile_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("borrower_profiles.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    checked_out_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    returned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    checkout_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    return_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    checked_out_by_user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    returned_by_user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=True
    )
