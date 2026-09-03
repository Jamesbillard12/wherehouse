import hashlib
import json
from dataclasses import asdict, dataclass
from decimal import Decimal
from enum import Enum
from typing import Protocol
from uuid import UUID

from sqlalchemy import String, and_, case, cast, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.context import ActorContext
from app.models import (
    Area,
    Container,
    ContainerPlacement,
    Item,
    ItemPlacement,
    WorkspaceMembership,
    Zone,
)
from app.models.core import ContainerRelationship, ItemIdentifierType
from app.services.container_codes import next_item_code


class MoveItemError(Exception):
    """Base error for failures callers are expected to map at an adapter boundary."""


class EntityNotFound(MoveItemError):
    def __init__(self, entity: str) -> None:
        super().__init__(f"{entity} not found")


class WorkspaceAccessDenied(MoveItemError):
    pass


class InvalidMove(MoveItemError):
    pass


class IdempotencyConflict(MoveItemError):
    pass


MAX_SEARCH_QUERY_LENGTH = 200


@dataclass(frozen=True)
class SearchItems:
    query: str
    limit: int = 50


@dataclass(frozen=True)
class ItemSearchMatch:
    item: Item
    resolved_path: str | None


def normalize_search_query(query: str) -> str:
    return " ".join(query.split()).casefold()


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


async def search_items(
    session: AsyncSession,
    actor: ActorContext,
    workspace_id: UUID,
    command: SearchItems,
) -> list[ItemSearchMatch]:
    """Return deterministic, active, workspace-scoped matches with canonical locations."""
    await _require_access(session, actor, workspace_id)
    query = normalize_search_query(command.query)
    if not query:
        return []
    if len(query) > MAX_SEARCH_QUERY_LENGTH:
        raise ValueError(f"Search query must be at most {MAX_SEARCH_QUERY_LENGTH} characters")

    escaped = _escape_like(query)
    contains = f"%{escaped}%"
    item_name = func.lower(Item.name)
    metadata_match = or_(
        item_name.ilike(contains, escape="\\"),
        func.lower(func.coalesce(Item.manufacturer, "")).ilike(contains, escape="\\"),
        func.lower(func.coalesce(Item.model, "")).ilike(contains, escape="\\"),
        func.lower(Item.code).ilike(contains, escape="\\"),
        func.lower(func.coalesce(Item.serial_number, "")).ilike(contains, escape="\\"),
        func.lower(func.coalesce(Area.name, "")).ilike(contains, escape="\\"),
        func.lower(func.coalesce(Zone.name, "")).ilike(contains, escape="\\"),
        func.lower(func.coalesce(Container.name, "")).ilike(contains, escape="\\"),
        func.lower(func.coalesce(Container.code, "")).ilike(contains, escape="\\"),
    )
    rank = case(
        (item_name == query, 0),
        (item_name.ilike(f"{escaped}%", escape="\\"), 1),
        (item_name.ilike(contains, escape="\\"), 2),
        else_=3,
    )
    workspace_area_ids = select(Area.id).where(Area.workspace_id == workspace_id)
    statement = (
        select(Item, ItemPlacement)
        .outerjoin(ItemPlacement, ItemPlacement.item_id == Item.id)
        .outerjoin(
            Container,
            and_(
                Container.id == ItemPlacement.container_id,
                Container.area_id.in_(workspace_area_ids),
                Container.is_archived.is_(False),
            ),
        )
        .outerjoin(
            Area,
            and_(
                Area.id == func.coalesce(ItemPlacement.area_id, Container.area_id),
                Area.workspace_id == workspace_id,
            ),
        )
        .outerjoin(
            Zone,
            and_(
                Zone.id == func.coalesce(ItemPlacement.zone_id, Container.zone_id),
                Zone.area_id.in_(workspace_area_ids),
            ),
        )
        .where(Item.workspace_id == workspace_id, Item.is_archived.is_(False), metadata_match)
        .order_by(rank, func.lower(Item.name), cast(Item.id, String))
        .limit(min(max(command.limit, 1), 100))
    )
    rows = list((await session.execute(statement)).all())
    placements = [placement for _, placement in rows if placement is not None]
    paths = await resolve_item_locations(session, actor, workspace_id, placements) if placements else {}
    return [ItemSearchMatch(item=item, resolved_path=paths.get(placement.id) if placement else None) for item, placement in rows]


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
    placement: "ItemDestination | None" = None


@dataclass(frozen=True)
class UpdateItem:
    name: str
    identifier_type: ItemIdentifierType
    quantity: Decimal
    description: str | None = None
    unit: str | None = None
    manufacturer: str | None = None
    model: str | None = None
    serial_number: str | None = None
    notes: str | None = None
    placement: "ItemDestination | None" = None


@dataclass(frozen=True)
class ItemDestination:
    area_id: UUID | None = None
    zone_id: UUID | None = None
    container_id: UUID | None = None
    relationship_type: ContainerRelationship | None = None

    def __post_init__(self) -> None:
        if sum(value is not None for value in (self.area_id, self.zone_id, self.container_id)) != 1:
            raise InvalidMove("Exactly one destination is required")
        if self.container_id is None and self.relationship_type is not None:
            raise InvalidMove("A relationship is only valid for a container destination")


def _json_value(value: object) -> object:
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, UUID):
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
    workspace_id: UUID,
    command: CreateItem,
    events: "EventPublisher",
) -> Item:
    await _require_access(session, actor, workspace_id)
    payload_hash = _creation_payload_hash(command)
    if command.client_operation_id is not None:
        existing = await session.scalar(
            select(Item).where(
                Item.workspace_id == workspace_id,
                Item.creation_operation_id == command.client_operation_id,
            )
        )
        if existing is not None:
            if existing.creation_payload_hash != payload_hash:
                raise IdempotencyConflict("Client operation ID was already used for another request")
            return existing

    if command.placement is not None:
        destination_workspace_id = await _destination_workspace(session, command.placement)
        if destination_workspace_id != workspace_id:
            raise InvalidMove("Item and destination must belong to the same workspace")

    values = asdict(command)
    values.pop("client_operation_id")
    placement_values = values.pop("placement")
    item = Item(
        workspace_id=workspace_id,
        code=await next_item_code(session),
        creation_operation_id=command.client_operation_id,
        creation_payload_hash=payload_hash if command.client_operation_id else None,
        **values,
    )
    session.add(item)
    try:
        await session.flush()
        if placement_values is not None:
            session.add(ItemPlacement(item_id=item.id, **placement_values))
        await session.commit()
        await session.refresh(item)
    except IntegrityError:
        await session.rollback()
        if command.client_operation_id is None:
            raise
        existing = await session.scalar(
            select(Item).where(
                Item.workspace_id == workspace_id,
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
        workspace_id,
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
    await _require_access(session, actor, item.workspace_id)

    item.is_archived = True
    try:
        await session.commit()
    except Exception:
        await session.rollback()
        raise

    await events.publish(
        item.workspace_id,
        entity="item",
        action="deleted",
        entity_id=item.id,
        source=actor.client,
    )


async def update_item(
    session: AsyncSession,
    actor: ActorContext,
    item_id: UUID,
    command: UpdateItem,
    events: "EventPublisher",
) -> Item:
    item = await session.get(Item, item_id)
    if item is None or item.is_archived:
        raise EntityNotFound("Item")
    await _require_access(session, actor, item.workspace_id)
    if command.placement is not None:
        destination_workspace_id = await _destination_workspace(session, command.placement)
        if destination_workspace_id != item.workspace_id:
            raise InvalidMove("Item and destination must belong to the same workspace")

    values = asdict(command)
    placement_values = values.pop("placement")
    for field, value in values.items():
        setattr(item, field, value)
    if placement_values is not None:
        placement = await session.scalar(
            select(ItemPlacement).where(ItemPlacement.item_id == item_id)
        )
        if placement is None:
            session.add(ItemPlacement(item_id=item_id, **placement_values))
        else:
            for field, value in placement_values.items():
                setattr(placement, field, value)
    try:
        await session.commit()
        await session.refresh(item)
    except Exception:
        await session.rollback()
        raise
    await events.publish(
        item.workspace_id,
        entity="item",
        action="updated",
        entity_id=item.id,
        source=actor.client,
    )
    return item


class EventPublisher(Protocol):
    async def publish(
        self,
        workspace_id: UUID,
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
        ItemDestination(
            area_id=self.area_id,
            zone_id=self.zone_id,
            container_id=self.container_id,
            relationship_type=self.relationship_type,
        )


async def _require_access(session: AsyncSession, actor: ActorContext, workspace_id: UUID) -> None:
    if actor.workspace_id is not None and actor.workspace_id != workspace_id:
        raise WorkspaceAccessDenied("Workspace access denied")
    membership = await session.scalar(
        select(WorkspaceMembership).where(
            WorkspaceMembership.workspace_id == workspace_id,
            WorkspaceMembership.user_id == actor.user_id,
        )
    )
    if membership is None:
        raise WorkspaceAccessDenied("Workspace access denied")


async def _destination_workspace(session: AsyncSession, command: MoveItem | ItemDestination) -> UUID:
    if command.area_id is not None:
        area = await session.get(Area, command.area_id)
        if area is None:
            raise EntityNotFound("Area")
        return area.workspace_id
    if command.zone_id is not None:
        zone = await session.get(Zone, command.zone_id)
        if zone is None:
            raise EntityNotFound("Zone")
        area = await session.get(Area, zone.area_id)
        if area is None:
            raise EntityNotFound("Zone area")
        return area.workspace_id
    container = await session.get(Container, command.container_id)
    if container is None:
        raise EntityNotFound("Container")
    area = await session.get(Area, container.area_id)
    if area is None:
        raise EntityNotFound("Container area")
    return area.workspace_id


async def resolve_item_location(
    session: AsyncSession, actor: ActorContext, placement: ItemPlacement
) -> str:
    item = await session.get(Item, placement.item_id)
    if item is None or item.is_archived:
        raise EntityNotFound("Item")
    await _require_access(session, actor, item.workspace_id)

    if placement.area_id is not None:
        area = await session.get(Area, placement.area_id)
        if area is None or area.workspace_id != item.workspace_id:
            raise InvalidMove("Item placement has an invalid area")
        return area.name

    if placement.zone_id is not None:
        zone = await session.get(Zone, placement.zone_id)
        area = await session.get(Area, zone.area_id) if zone else None
        if zone is None or area is None or area.workspace_id != item.workspace_id:
            raise InvalidMove("Item placement has an invalid zone")
        return f"{area.name} > {zone.name}"

    container = await session.get(Container, placement.container_id)
    if container is None or container.is_archived:
        raise InvalidMove("Item placement has an invalid container")
    area = await session.get(Area, container.area_id)
    if area is None or area.workspace_id != item.workspace_id:
        raise InvalidMove("Item placement crosses a workspace boundary")
    zone = await session.get(Zone, container.zone_id) if container.zone_id else None
    if zone is not None and zone.area_id != area.id:
        raise InvalidMove("Container zone does not belong to its area")

    names = [container.name]
    visited = {container.id}
    cursor = container.id
    while True:
        parent_id = await session.scalar(
            select(ContainerPlacement.parent_container_id).where(
                ContainerPlacement.container_id == cursor
            )
        )
        if parent_id is None:
            break
        if parent_id in visited:
            raise InvalidMove("Container hierarchy contains a cycle")
        visited.add(parent_id)
        parent = await session.get(Container, parent_id)
        if parent is None or parent.is_archived or parent.area_id != area.id:
            raise InvalidMove("Container hierarchy is malformed")
        names.append(parent.name)
        cursor = parent.id
    prefix = [area.name]
    if zone is not None:
        prefix.append(zone.name)
    return " > ".join(prefix + list(reversed(names)))


async def resolve_item_locations(
    session: AsyncSession,
    actor: ActorContext,
    workspace_id: UUID,
    placements: list[ItemPlacement],
) -> dict[UUID, str]:
    """Resolve a workspace's item paths with bounded queries for list consumers."""
    await _require_access(session, actor, workspace_id)
    areas = list(await session.scalars(select(Area).where(Area.workspace_id == workspace_id)))
    area_by_id = {area.id: area for area in areas}
    area_ids = list(area_by_id)
    zones = list(await session.scalars(select(Zone).where(Zone.area_id.in_(area_ids))))
    zone_by_id = {zone.id: zone for zone in zones}
    containers = list(
        await session.scalars(
            select(Container).where(
                Container.area_id.in_(area_ids), Container.is_archived.is_(False)
            )
        )
    )
    container_by_id = {container.id: container for container in containers}
    nesting = list(
        await session.scalars(
            select(ContainerPlacement).where(
                ContainerPlacement.container_id.in_(list(container_by_id))
            )
        )
    )
    parent_by_child = {
        placement.container_id: placement.parent_container_id for placement in nesting
    }

    def container_path(container_id: UUID) -> str:
        container = container_by_id.get(container_id)
        if container is None:
            raise InvalidMove("Item placement has an invalid container")
        area = area_by_id.get(container.area_id)
        if area is None:
            raise InvalidMove("Item placement crosses a workspace boundary")
        zone = zone_by_id.get(container.zone_id) if container.zone_id else None
        if zone is not None and zone.area_id != area.id:
            raise InvalidMove("Container zone does not belong to its area")
        names: list[str] = []
        visited: set[UUID] = set()
        cursor: UUID | None = container.id
        while cursor is not None:
            if cursor in visited:
                raise InvalidMove("Container hierarchy contains a cycle")
            visited.add(cursor)
            current = container_by_id.get(cursor)
            if current is None or current.area_id != area.id:
                raise InvalidMove("Container hierarchy is malformed")
            names.append(current.name)
            cursor = parent_by_child.get(cursor)
        return " > ".join(
            [area.name, *([zone.name] if zone is not None else []), *reversed(names)]
        )

    paths: dict[UUID, str] = {}
    for placement in placements:
        if placement.area_id is not None:
            area = area_by_id.get(placement.area_id)
            if area is None:
                raise InvalidMove("Item placement has an invalid area")
            paths[placement.id] = area.name
        elif placement.zone_id is not None:
            zone = zone_by_id.get(placement.zone_id)
            area = area_by_id.get(zone.area_id) if zone else None
            if zone is None or area is None:
                raise InvalidMove("Item placement has an invalid zone")
            paths[placement.id] = f"{area.name} > {zone.name}"
        elif placement.container_id is not None:
            paths[placement.id] = container_path(placement.container_id)
        else:
            raise InvalidMove("Item placement has no destination")
    return paths


async def move_item(
    session: AsyncSession,
    actor: ActorContext,
    command: MoveItem,
    events: EventPublisher,
) -> ItemPlacement:
    item = await session.get(Item, command.item_id)
    if item is None:
        raise EntityNotFound("Item")
    await _require_access(session, actor, item.workspace_id)

    destination_workspace_id = await _destination_workspace(session, command)
    if destination_workspace_id != item.workspace_id:
        raise InvalidMove("Item and destination must belong to the same workspace")

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
        item.workspace_id,
        entity="item-placement",
        action="updated",
        entity_id=placement.id,
        source=actor.client,
    )
    return placement
