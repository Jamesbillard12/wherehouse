from dataclasses import dataclass
from typing import Protocol
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.context import ActorContext
from app.models import Area, Container, ContainerPlacement, HouseholdUser
from app.models.core import ContainerRelationship


class LocationError(Exception):
    pass


class LocationNotFound(LocationError):
    pass


class LocationAccessDenied(LocationError):
    pass


class InvalidContainerPlacement(LocationError):
    pass


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
