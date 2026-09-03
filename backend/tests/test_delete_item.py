from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.application.context import ActorContext
from app.application.items.capabilities import (
    EntityNotFound,
    WorkspaceAccessDenied,
    delete_item,
)
from app.models import Item


class FakeSession:
    def __init__(self, item, membership=None) -> None:
        self.item = item
        self.membership = SimpleNamespace() if membership is None else membership
        self.commit = AsyncMock()
        self.rollback = AsyncMock()

    async def get(self, model, _entity_id):
        return self.item if model is Item else None

    async def scalar(self, _statement):
        return self.membership


class EventRecorder:
    def __init__(self) -> None:
        self.events = []

    async def publish(self, workspace_id, **event) -> None:
        self.events.append((workspace_id, event))


def actor(*, workspace_id=None) -> ActorContext:
    return ActorContext(user_id=uuid4(), client="test", workspace_id=workspace_id)


async def test_delete_item_archives_and_publishes() -> None:
    workspace_id = uuid4()
    item_id = uuid4()
    item = SimpleNamespace(id=item_id, workspace_id=workspace_id, is_archived=False)
    session = FakeSession(item)
    events = EventRecorder()

    await delete_item(session, actor(), item_id, events)

    assert item.is_archived is True
    session.commit.assert_awaited_once()
    session.rollback.assert_not_awaited()
    assert events.events == [
        (
            workspace_id,
            {
                "entity": "item",
                "action": "deleted",
                "entity_id": item_id,
                "source": "test",
            },
        )
    ]


@pytest.mark.parametrize("item", [None, SimpleNamespace(is_archived=True)])
async def test_delete_item_rejects_missing_or_already_deleted_item(item) -> None:
    session = FakeSession(item)

    with pytest.raises(EntityNotFound, match="Item not found"):
        await delete_item(session, actor(), uuid4(), EventRecorder())

    session.commit.assert_not_awaited()


async def test_delete_item_enforces_workspace_access() -> None:
    item = SimpleNamespace(id=uuid4(), workspace_id=uuid4(), is_archived=False)
    session = FakeSession(item)

    with pytest.raises(WorkspaceAccessDenied):
        await delete_item(
            session,
            actor(workspace_id=uuid4()),
            item.id,
            EventRecorder(),
        )

    assert item.is_archived is False
    session.commit.assert_not_awaited()


async def test_delete_item_rolls_back_without_publishing_on_failure() -> None:
    item = SimpleNamespace(id=uuid4(), workspace_id=uuid4(), is_archived=False)
    session = FakeSession(item)
    session.commit.side_effect = RuntimeError("database unavailable")
    events = EventRecorder()

    with pytest.raises(RuntimeError, match="database unavailable"):
        await delete_item(session, actor(), item.id, events)

    session.rollback.assert_awaited_once()
    assert events.events == []
