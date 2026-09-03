from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.application.context import ActorContext
from app.application.items.capabilities import (
    CreateItem,
    IdempotencyConflict,
    ItemDestination,
    create_item,
)
from app.models import Area, ItemPlacement
from app.models.core import ItemIdentifierType


class FakeSession:
    def __init__(self, scalars: list[object], entities: dict[tuple[type, object], object] | None = None) -> None:
        self.scalars = iter(scalars)
        self.entities = entities or {}
        self.added = []
        self.commit = AsyncMock()
        self.flush = AsyncMock(side_effect=self._assign_ids)
        self.rollback = AsyncMock()

    async def scalar(self, _statement):
        return next(self.scalars)

    async def get(self, model, entity_id):
        return self.entities.get((model, entity_id))

    def add(self, entity) -> None:
        self.added.append(entity)

    async def refresh(self, entity) -> None:
        if entity.id is None:
            entity.id = uuid4()

    def _assign_ids(self) -> None:
        for entity in self.added:
            if entity.id is None:
                entity.id = uuid4()


class EventRecorder:
    def __init__(self) -> None:
        self.events = []

    async def publish(self, workspace_id, **event) -> None:
        self.events.append((workspace_id, event))


def command(**changes) -> CreateItem:
    values = {
        "name": "Tent",
        "identifier_type": ItemIdentifierType.NONE,
        "quantity": Decimal(1),
        "client_operation_id": "draft-123",
    }
    values.update(changes)
    return CreateItem(**values)


async def test_create_item_persists_operation_and_publishes_once() -> None:
    workspace_id = uuid4()
    session = FakeSession([SimpleNamespace(), None, 42])
    events = EventRecorder()

    item = await create_item(
        session,
        ActorContext(user_id=uuid4(), client="mobile"),
        workspace_id,
        command(),
        events,
    )

    assert item.code == "ITM-000042"
    assert item.creation_operation_id == "draft-123"
    assert len(item.creation_payload_hash) == 64
    session.commit.assert_awaited_once()
    assert events.events[0][1]["action"] == "created"


async def test_create_item_replay_returns_existing_without_write_or_event() -> None:
    workspace_id = uuid4()
    first_command = command()
    first_session = FakeSession([SimpleNamespace(), None, 1])
    first_item = await create_item(
        first_session,
        ActorContext(user_id=uuid4(), client="mobile"),
        workspace_id,
        first_command,
        EventRecorder(),
    )
    replay_session = FakeSession([SimpleNamespace(), first_item])
    replay_events = EventRecorder()

    replayed = await create_item(
        replay_session,
        ActorContext(user_id=uuid4(), client="mobile"),
        workspace_id,
        first_command,
        replay_events,
    )

    assert replayed is first_item
    replay_session.commit.assert_not_awaited()
    assert replay_session.added == []
    assert replay_events.events == []


async def test_create_item_and_initial_placement_commit_atomically() -> None:
    workspace_id = uuid4()
    area_id = uuid4()
    session = FakeSession(
        [SimpleNamespace(), None, 42],
        {(Area, area_id): SimpleNamespace(id=area_id, workspace_id=workspace_id)},
    )

    item = await create_item(
        session,
        ActorContext(user_id=uuid4(), client="web"),
        workspace_id,
        command(placement=ItemDestination(area_id=area_id)),
        EventRecorder(),
    )

    placement = next(entity for entity in session.added if isinstance(entity, ItemPlacement))
    assert placement.item_id == item.id
    assert placement.area_id == area_id
    session.commit.assert_awaited_once()


async def test_create_item_rejects_reused_operation_with_different_payload() -> None:
    workspace_id = uuid4()
    first_session = FakeSession([SimpleNamespace(), None, 1])
    first_item = await create_item(
        first_session,
        ActorContext(user_id=uuid4(), client="mobile"),
        workspace_id,
        command(),
        EventRecorder(),
    )
    replay_session = FakeSession([SimpleNamespace(), first_item])

    with pytest.raises(IdempotencyConflict, match="already used"):
        await create_item(
            replay_session,
            ActorContext(user_id=uuid4(), client="mobile"),
            workspace_id,
            command(name="Sleeping bag"),
            EventRecorder(),
        )
