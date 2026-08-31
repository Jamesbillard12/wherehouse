from __future__ import annotations

import enum
from decimal import Decimal
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Enum,
    ForeignKey,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


def enum_values(enum_cls: type[enum.Enum]) -> list[str]:
    return [member.value for member in enum_cls]


class HouseholdRelationship(str, enum.Enum):
    OWNER = "owner"
    BORROWER = "borrower"


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


class Household(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "households"

    name: Mapped[str] = mapped_column(String(200), nullable=False)

    users: Mapped[list[HouseholdUser]] = relationship(back_populates="household")
    areas: Mapped[list[Area]] = relationship(back_populates="household")


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)

    households: Mapped[list[HouseholdUser]] = relationship(back_populates="user")


class HouseholdUser(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "household_users"
    __table_args__ = (UniqueConstraint("household_id", "user_id", name="uq_household_user"),)

    household_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("households.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    relationship_type: Mapped[HouseholdRelationship] = mapped_column(
        Enum(
            HouseholdRelationship,
            name="household_relationship",
            values_callable=enum_values,
        ),
        nullable=False,
    )

    household: Mapped[Household] = relationship(back_populates="users")
    user: Mapped[User] = relationship(back_populates="households")


class Area(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "areas"
    __table_args__ = (UniqueConstraint("household_id", "name", name="uq_area_household_name"),)

    household_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("households.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    icon: Mapped[str] = mapped_column(String(50), nullable=False, default="warehouse")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    household: Mapped[Household] = relationship(back_populates="areas")
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
    __table_args__ = (UniqueConstraint("code", name="uq_item_code"),)

    household_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("households.id", ondelete="CASCADE"),
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
