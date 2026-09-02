from dataclasses import dataclass
from typing import Protocol
from uuid import UUID

from sqlalchemy import String, case, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.context import ActorContext
from app.models import Area, Container, ContainerPlacement, HouseholdUser, Zone
from app.models.core import ContainerRelationship


class LocationError(Exception):
    pass


class LocationNotFound(LocationError):
    pass


class LocationAccessDenied(LocationError):
    pass


class InvalidContainerPlacement(LocationError):
    pass


@dataclass(frozen=True)
class SearchContainers:
    query: str
    limit: int = 25


@dataclass(frozen=True)
class ContainerSearchMatch:
    container: Container
    resolved_path: str


async def search_containers(
    session: AsyncSession,
    actor: ActorContext,
    household_id: UUID,
    command: SearchContainers,
) -> list[ContainerSearchMatch]:
    if actor.household_id is not None and actor.household_id != household_id:
        raise LocationAccessDenied("Household access denied")
    membership = await session.scalar(
        select(HouseholdUser).where(
            HouseholdUser.household_id == household_id,
            HouseholdUser.user_id == actor.user_id,
        )
    )
    if membership is None:
        raise LocationAccessDenied("Household access denied")
    query = " ".join(command.query.split()).casefold()
    if not query:
        return []
    if len(query) > 200:
        raise ValueError("Search query must be at most 200 characters")
    escaped = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    contains = f"%{escaped}%"
    name = func.lower(Container.name)
    statement = (
        select(Container)
        .join(Area, Area.id == Container.area_id)
        .outerjoin(Zone, Zone.id == Container.zone_id)
        .where(
            Area.household_id == household_id,
            Container.is_archived.is_(False),
            or_(
                name.ilike(contains, escape="\\"),
                func.lower(Container.code).ilike(contains, escape="\\"),
                func.lower(func.coalesce(Container.description, "")).ilike(contains, escape="\\"),
                func.lower(Area.name).ilike(contains, escape="\\"),
                func.lower(func.coalesce(Zone.name, "")).ilike(contains, escape="\\"),
            ),
        )
        .order_by(
            case(
                (name == query, 0),
                (name.ilike(f"{escaped}%", escape="\\"), 1),
                (name.ilike(contains, escape="\\"), 2),
                else_=3,
            ),
            name,
            cast(Container.id, String),
        )
        .limit(min(max(command.limit, 1), 50))
    )
    containers = list(await session.scalars(statement))
    if not containers:
        return []

    areas = list(await session.scalars(select(Area).where(Area.household_id == household_id)))
    area_by_id = {area.id: area for area in areas}
    area_ids = list(area_by_id)
    zones = list(await session.scalars(select(Zone).where(Zone.area_id.in_(area_ids))))
    zone_by_id = {zone.id: zone for zone in zones}
    all_containers = list(
        await session.scalars(
            select(Container).where(
                Container.area_id.in_(area_ids), Container.is_archived.is_(False)
            )
        )
    )
    container_by_id = {container.id: container for container in all_containers}
    placements = list(
        await session.scalars(
            select(ContainerPlacement).where(
                ContainerPlacement.container_id.in_(list(container_by_id))
            )
        )
    )
    parent_by_child = {placement.container_id: placement.parent_container_id for placement in placements}

    def path_for(container: Container) -> str:
        area = area_by_id[container.area_id]
        zone = zone_by_id.get(container.zone_id) if container.zone_id else None
        names: list[str] = []
        visited: set[UUID] = set()
        cursor: UUID | None = container.id
        while cursor is not None:
            if cursor in visited or cursor not in container_by_id:
                raise InvalidContainerPlacement("Container hierarchy is malformed")
            visited.add(cursor)
            names.append(container_by_id[cursor].name)
            cursor = parent_by_child.get(cursor)
        return " > ".join([area.name, *([zone.name] if zone else []), *reversed(names)])

    return [ContainerSearchMatch(container=container, resolved_path=path_for(container)) for container in containers]


class EventPublisher(Protocol):
    async def publish(self, household_id: UUID, **event: object) -> None: ...


@dataclass(frozen=True)
class PlaceContainer:
    container_id: UUID
    parent_container_id: UUID
    relationship_type: ContainerRelationship
    position: int | None = None


async def place_container(
    session: AsyncSession,
    actor: ActorContext,
    command: PlaceContainer,
    events: EventPublisher,
) -> ContainerPlacement:
    container = await session.get(Container, command.container_id)
    parent = await session.get(Container, command.parent_container_id)
    if container is None or container.is_archived:
        raise LocationNotFound("Container not found")
    if parent is None or parent.is_archived:
        raise LocationNotFound("Parent container not found")
    area = await session.get(Area, container.area_id)
    parent_area = await session.get(Area, parent.area_id)
    if area is None or parent_area is None:
        raise LocationNotFound("Container area not found")
    if actor.household_id is not None and actor.household_id != area.household_id:
        raise LocationAccessDenied("Household access denied")
    membership = await session.scalar(
        select(HouseholdUser).where(
            HouseholdUser.household_id == area.household_id,
            HouseholdUser.user_id == actor.user_id,
        )
    )
    if membership is None:
        raise LocationAccessDenied("Household access denied")
    if parent_area.household_id != area.household_id or parent.area_id != container.area_id:
        raise InvalidContainerPlacement("Nested containers must belong to the same household and area")
    if parent.zone_id != container.zone_id:
        raise InvalidContainerPlacement("Nested containers must belong to the same zone")

    ancestor_id: UUID | None = parent.id
    visited: set[UUID] = set()
    while ancestor_id is not None:
        if ancestor_id == container.id:
            raise InvalidContainerPlacement("Container placement would create a cycle")
        if ancestor_id in visited:
            raise InvalidContainerPlacement("Container hierarchy already contains a cycle")
        visited.add(ancestor_id)
        ancestor_id = await session.scalar(
            select(ContainerPlacement.parent_container_id).where(
                ContainerPlacement.container_id == ancestor_id
            )
        )

    placement = await session.scalar(
        select(ContainerPlacement).where(ContainerPlacement.container_id == container.id)
    )
    if placement is None:
        placement = ContainerPlacement(
            container_id=container.id,
            parent_container_id=parent.id,
            relationship_type=command.relationship_type,
            position=command.position,
        )
        session.add(placement)
    else:
        placement.parent_container_id = parent.id
        placement.relationship_type = command.relationship_type
        placement.position = command.position
    try:
        await session.commit()
        await session.refresh(placement)
    except Exception:
        await session.rollback()
        raise
    await events.publish(
        area.household_id,
        entity="container-placement",
        action="updated",
        entity_id=placement.id,
        source=actor.client,
    )
    return placement
