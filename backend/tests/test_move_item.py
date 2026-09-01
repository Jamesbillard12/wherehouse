from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.application.context import ActorContext
from app.application.items.capabilities import (
    EntityNotFound,
    HouseholdAccessDenied,
    InvalidMove,
    MoveItem,
    move_item,
)
from app.models import Area, Container, Item, ItemPlacement, Zone
from app.models.core import ContainerRelationship


class FakeSession:
    def __init__(self, entities: dict[tuple[type, object], object], scalars: list[object]) -> None:
        self.entities = entities
        self.scalars = iter(scalars)
        self.added: list[object] = []
        self.flush = AsyncMock()
        self.commit = AsyncMock()
        self.rollback = AsyncMock()

    async def get(self, model: type, entity_id: object):
        return self.entities.get((model, entity_id))

    async def scalar(self, _statement):
        return next(self.scalars)

    def add(self, entity: object) -> None:
        self.added.append(entity)

    async def refresh(self, entity: object) -> None:
        if getattr(entity, "id", None) is None:
            entity.id = uuid4()


class EventRecorder:
    def __init__(self) -> None:
        self.events: list[tuple[object, dict[str, object]]] = []

    async def publish(self, household_id, **event) -> None:
        self.events.append((household_id, event))


def actor(*, household_id=None) -> ActorContext:
    return ActorContext(user_id=uuid4(), client="test", household_id=household_id)


@pytest.mark.parametrize("destination", ["area", "zone", "container"])
async def test_move_item_supports_each_destination(destination: str) -> None:
    household_id = uuid4()
    item_id = uuid4()
    area_id = uuid4()
    zone_id = uuid4()
    container_id = uuid4()
    command_values = {
        "area": {"area_id": area_id},
        "zone": {"zone_id": zone_id},
        "container": {
            "container_id": container_id,
            "relationship_type": ContainerRelationship.IN,
        },
    }[destination]
    session = FakeSession(
        {
            (Item, item_id): SimpleNamespace(id=item_id, household_id=household_id),
            (Area, area_id): SimpleNamespace(id=area_id, household_id=household_id),
            (Zone, zone_id): SimpleNamespace(id=zone_id, area_id=area_id),
            (Container, container_id): SimpleNamespace(id=container_id, area_id=area_id),
        },
        [SimpleNamespace(), None],
    )
    events = EventRecorder()

    placement = await move_item(
        session, actor(), MoveItem(item_id=item_id, **command_values), events
    )

    session.commit.assert_awaited_once()
    session.rollback.assert_not_awaited()
    assert len(session.added) == 1
    assert placement.area_id == command_values.get("area_id")
    assert placement.zone_id == command_values.get("zone_id")
    assert placement.container_id == command_values.get("container_id")
    assert events.events == [
        (
            household_id,
            {
                "entity": "item-placement",
                "action": "updated",
                "entity_id": placement.id,
                "source": "test",
            },
        )
    ]


async def test_move_item_replaces_the_existing_destination() -> None:
    household_id = uuid4()
    item_id = uuid4()
    area_id = uuid4()
    placement = ItemPlacement(
        id=uuid4(),
        item_id=item_id,
        container_id=uuid4(),
        relationship_type=ContainerRelationship.ON,
    )
    session = FakeSession(
        {
            (Item, item_id): SimpleNamespace(id=item_id, household_id=household_id),
            (Area, area_id): SimpleNamespace(id=area_id, household_id=household_id),
        },
        [SimpleNamespace(), placement],
    )

    result = await move_item(
        session, actor(), MoveItem(item_id=item_id, area_id=area_id), EventRecorder()
    )

    assert result is placement
    assert not session.added
    assert placement.area_id == area_id
    assert placement.zone_id is None
    assert placement.container_id is None
    assert placement.relationship_type is None


async def test_move_item_rejects_an_unknown_destination() -> None:
    household_id = uuid4()
    item_id = uuid4()
    area_id = uuid4()
    session = FakeSession(
        {(Item, item_id): SimpleNamespace(id=item_id, household_id=household_id)},
        [SimpleNamespace()],
    )

    with pytest.raises(EntityNotFound, match="Area not found"):
        await move_item(
            session, actor(), MoveItem(item_id=item_id, area_id=area_id), EventRecorder()
        )

    session.commit.assert_not_awaited()


async def test_move_item_rejects_a_cross_household_destination() -> None:
    item_household_id = uuid4()
    item_id = uuid4()
    area_id = uuid4()
    session = FakeSession(
        {
            (Item, item_id): SimpleNamespace(id=item_id, household_id=item_household_id),
            (Area, area_id): SimpleNamespace(id=area_id, household_id=uuid4()),
        },
        [SimpleNamespace()],
    )

    with pytest.raises(InvalidMove, match="same household"):
        await move_item(
            session, actor(), MoveItem(item_id=item_id, area_id=area_id), EventRecorder()
        )


async def test_move_item_enforces_actor_household_and_membership() -> None:
    household_id = uuid4()
    item_id = uuid4()
    area_id = uuid4()
    entities = {
        (Item, item_id): SimpleNamespace(id=item_id, household_id=household_id),
        (Area, area_id): SimpleNamespace(id=area_id, household_id=household_id),
    }

    restricted_session = FakeSession(entities, [])
    with pytest.raises(HouseholdAccessDenied):
        await move_item(
            restricted_session,
            actor(household_id=uuid4()),
            MoveItem(item_id=item_id, area_id=area_id),
            EventRecorder(),
        )

    nonmember_session = FakeSession(entities, [None])
    with pytest.raises(HouseholdAccessDenied):
        await move_item(
            nonmember_session,
            actor(),
            MoveItem(item_id=item_id, area_id=area_id),
            EventRecorder(),
        )


async def test_move_item_rolls_back_and_does_not_publish_when_commit_fails() -> None:
    household_id = uuid4()
    item_id = uuid4()
    area_id = uuid4()
    session = FakeSession(
        {
            (Item, item_id): SimpleNamespace(id=item_id, household_id=household_id),
            (Area, area_id): SimpleNamespace(id=area_id, household_id=household_id),
        },
        [SimpleNamespace(), None],
    )
    session.commit.side_effect = RuntimeError("database unavailable")
    events = EventRecorder()

    with pytest.raises(RuntimeError, match="database unavailable"):
        await move_item(session, actor(), MoveItem(item_id=item_id, area_id=area_id), events)

    session.rollback.assert_awaited_once()
    assert events.events == []


def test_move_item_command_validates_adapter_independent_input() -> None:
    with pytest.raises(InvalidMove, match="Exactly one"):
        MoveItem(item_id=uuid4())
    with pytest.raises(InvalidMove, match="relationship"):
        MoveItem(item_id=uuid4(), area_id=uuid4(), relationship_type=ContainerRelationship.IN)
