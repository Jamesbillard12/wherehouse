from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.application.context import ActorContext
from app.application.locations.capabilities import (
    InvalidContainerPlacement,
    PlaceContainer,
    place_container,
)
from app.models import Area, Container
from app.models.core import ContainerRelationship


class FakeSession:
    def __init__(self, entities, scalars):
        self.entities = entities
        self.scalars = iter(scalars)
        self.added = []
        self.commit = AsyncMock()
        self.rollback = AsyncMock()

    async def get(self, model, entity_id):
        return self.entities.get((model, entity_id))

    async def scalar(self, _statement):
        return next(self.scalars)

    def add(self, entity):
        self.added.append(entity)

    async def refresh(self, entity):
        if entity.id is None:
            entity.id = uuid4()


class Events:
    def __init__(self):
        self.values = []

    async def publish(self, household_id, **event):
        self.values.append((household_id, event))


def fixture():
    household_id = uuid4()
    area_id = uuid4()
    child_id = uuid4()
    parent_id = uuid4()
    area = SimpleNamespace(id=area_id, household_id=household_id)
    entities = {
        (Area, area_id): area,
        (Container, child_id): SimpleNamespace(id=child_id, area_id=area_id, is_archived=False),
        (Container, parent_id): SimpleNamespace(id=parent_id, area_id=area_id, is_archived=False),
    }
    return household_id, child_id, parent_id, entities


async def test_places_nested_container_and_publishes_after_commit() -> None:
    _, child_id, parent_id, entities = fixture()
    session = FakeSession(entities, [SimpleNamespace(), None, None])
    events = Events()

    placement = await place_container(
        session,
        ActorContext(user_id=uuid4(), client="web"),
        PlaceContainer(child_id, parent_id, ContainerRelationship.IN),
        events,
    )

    assert placement.parent_container_id == parent_id
    session.commit.assert_awaited_once()
    assert events.values[0][1]["action"] == "updated"


async def test_rejects_descendant_as_parent_without_writing() -> None:
    _, child_id, parent_id, entities = fixture()
    session = FakeSession(entities, [SimpleNamespace(), child_id])

    with pytest.raises(InvalidContainerPlacement, match="cycle"):
        await place_container(
            session,
            ActorContext(user_id=uuid4(), client="web"),
            PlaceContainer(child_id, parent_id, ContainerRelationship.IN),
            Events(),
        )

    session.commit.assert_not_awaited()


async def test_rolls_back_and_does_not_publish_on_failure() -> None:
    _, child_id, parent_id, entities = fixture()
    session = FakeSession(entities, [SimpleNamespace(), None, None])
    session.commit.side_effect = RuntimeError("database unavailable")
    events = Events()

    with pytest.raises(RuntimeError):
        await place_container(
            session,
            ActorContext(user_id=uuid4(), client="web"),
            PlaceContainer(child_id, parent_id, ContainerRelationship.ON),
            events,
        )

    session.rollback.assert_awaited_once()
    assert events.values == []
