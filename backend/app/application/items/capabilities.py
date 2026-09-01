import hashlib
import json
from dataclasses import asdict, dataclass
from decimal import Decimal
from enum import Enum
from typing import Protocol
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.context import ActorContext
from app.models import Area, Container, HouseholdUser, Item, ItemPlacement, Zone
from app.models.core import ContainerRelationship, ItemIdentifierType
from app.services.container_codes import next_item_code


class MoveItemError(Exception):
    """Base error for failures callers are expected to map at an adapter boundary."""


class EntityNotFound(MoveItemError):
    def __init__(self, entity: str) -> None:
        super().__init__(f"{entity} not found")


class HouseholdAccessDenied(MoveItemError):
    pass


class InvalidMove(MoveItemError):
    pass


class IdempotencyConflict(MoveItemError):
    pass


@dataclass(frozen=True)
class CreateItem:
    name: str
    identifier_type: ItemIdentifierType
    quantity: Decimal
    client_operation_id: str | None = None
    description: str | None = None
    unit: str | None = None
    manufacturer: str | None = None
    model: str | None = None
    serial_number: str | None = None
    notes: str | None = None


def _json_value(value: object) -> object:
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, Decimal):
        return str(value)
    raise TypeError(f"Unsupported creation payload value: {type(value).__name__}")


def _creation_payload_hash(command: CreateItem) -> str:
    values = asdict(command)
    values.pop("client_operation_id")
    encoded = json.dumps(
        values, sort_keys=True, separators=(",", ":"), default=_json_value
    ).encode()
    return hashlib.sha256(encoded).hexdigest()


async def create_item(
    session: AsyncSession,
    actor: ActorContext,
    household_id: UUID,
    command: CreateItem,
    events: "EventPublisher",
) -> Item:
    await _require_access(session, actor, household_id)
    payload_hash = _creation_payload_hash(command)
    if command.client_operation_id is not None:
        existing = await session.scalar(
            select(Item).where(
                Item.household_id == household_id,
                Item.creation_operation_id == command.client_operation_id,
            )
        )
        if existing is not None:
            if existing.creation_payload_hash != payload_hash:
                raise IdempotencyConflict("Client operation ID was already used for another request")
            return existing

    values = asdict(command)
    values.pop("client_operation_id")
    item = Item(
        household_id=household_id,
        code=await next_item_code(session),
        creation_operation_id=command.client_operation_id,
        creation_payload_hash=payload_hash if command.client_operation_id else None,
        **values,
    )
    session.add(item)
    try:
        await session.commit()
        await session.refresh(item)
    except IntegrityError:
        await session.rollback()
        if command.client_operation_id is None:
            raise
        existing = await session.scalar(
            select(Item).where(
                Item.household_id == household_id,
                Item.creation_operation_id == command.client_operation_id,
            )
        )
        if existing is None:
            raise
        if existing.creation_payload_hash != payload_hash:
            raise IdempotencyConflict(
                "Client operation ID was already used for another request"
            )
        return existing
    except Exception:
        await session.rollback()
        raise
    await events.publish(
        household_id,
        entity="item",
        action="created",
        entity_id=item.id,
        source=actor.client,
    )
    return item


async def delete_item(
    session: AsyncSession,
    actor: ActorContext,
    item_id: UUID,
    events: "EventPublisher",
) -> None:
    item = await session.get(Item, item_id)
    if item is None or item.is_archived:
        raise EntityNotFound("Item")
    await _require_access(session, actor, item.household_id)

    item.is_archived = True
    try:
        await session.commit()
    except Exception:
        await session.rollback()
        raise

    await events.publish(
        item.household_id,
        entity="item",
        action="deleted",
        entity_id=item.id,
        source=actor.client,
    )


class EventPublisher(Protocol):
    async def publish(
        self,
        household_id: UUID,
        *,
        entity: str,
        action: str,
        entity_id: UUID,
        source: str,
    ) -> None: ...


@dataclass(frozen=True)
class MoveItem:
    item_id: UUID
    area_id: UUID | None = None
    zone_id: UUID | None = None
    container_id: UUID | None = None
    relationship_type: ContainerRelationship | None = None

    def __post_init__(self) -> None:
        targets = (self.area_id, self.zone_id, self.container_id)
        if sum(target is not None for target in targets) != 1:
            raise InvalidMove("Exactly one destination is required")
        if self.container_id is None and self.relationship_type is not None:
            raise InvalidMove("A relationship is only valid for a container destination")


async def _require_access(session: AsyncSession, actor: ActorContext, household_id: UUID) -> None:
    if actor.household_id is not None and actor.household_id != household_id:
        raise HouseholdAccessDenied("Household access denied")
    membership = await session.scalar(
        select(HouseholdUser).where(
            HouseholdUser.household_id == household_id,
            HouseholdUser.user_id == actor.user_id,
        )
    )
    if membership is None:
        raise HouseholdAccessDenied("Household access denied")


async def _destination_household(session: AsyncSession, command: MoveItem) -> UUID:
    if command.area_id is not None:
        area = await session.get(Area, command.area_id)
        if area is None:
            raise EntityNotFound("Area")
        return area.household_id
    if command.zone_id is not None:
        zone = await session.get(Zone, command.zone_id)
        if zone is None:
            raise EntityNotFound("Zone")
        area = await session.get(Area, zone.area_id)
        if area is None:
            raise EntityNotFound("Zone area")
        return area.household_id
    container = await session.get(Container, command.container_id)
    if container is None:
        raise EntityNotFound("Container")
    area = await session.get(Area, container.area_id)
    if area is None:
        raise EntityNotFound("Container area")
    return area.household_id


async def move_item(
    session: AsyncSession,
    actor: ActorContext,
    command: MoveItem,
    events: EventPublisher,
) -> ItemPlacement:
    item = await session.get(Item, command.item_id)
    if item is None:
        raise EntityNotFound("Item")
    await _require_access(session, actor, item.household_id)

    destination_household_id = await _destination_household(session, command)
    if destination_household_id != item.household_id:
        raise InvalidMove("Item and destination must belong to the same household")

    placement = await session.scalar(
        select(ItemPlacement).where(ItemPlacement.item_id == command.item_id)
    )
    values = {
        "area_id": command.area_id,
        "zone_id": command.zone_id,
        "container_id": command.container_id,
        "relationship_type": command.relationship_type,
    }
    if placement is None:
        placement = ItemPlacement(item_id=command.item_id, **values)
        session.add(placement)
    else:
        for field, value in values.items():
            setattr(placement, field, value)

    try:
        await session.flush()
        await session.refresh(placement)
        await session.commit()
    except Exception:
        await session.rollback()
        raise

    await events.publish(
        item.household_id,
        entity="item-placement",
        action="updated",
        entity_id=placement.id,
        source=actor.client,
    )
    return placement
