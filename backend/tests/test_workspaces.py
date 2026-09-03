from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.application.context import ActorContext
from app.application.workspaces.capabilities import (
    CreateWorkspace,
    InvalidWorkspace,
    create_workspace,
)
from app.models import Workspace, WorkspaceMembership, WorkspaceRole


class WorkspaceSession:
    def __init__(self) -> None:
        self.added = []
        self.flush = AsyncMock(side_effect=self._assign_id)
        self.commit = AsyncMock()
        self.rollback = AsyncMock()
        self.refresh = AsyncMock()

    def add(self, entity) -> None:
        self.added.append(entity)

    def _assign_id(self) -> None:
        self.added[0].id = uuid4()


async def test_create_workspace_atomically_adds_owner_membership() -> None:
    user_id = uuid4()
    session = WorkspaceSession()

    workspace = await create_workspace(
        session, ActorContext(user_id=user_id, client="test"), CreateWorkspace("  Home  ")
    )

    assert isinstance(workspace, Workspace)
    assert workspace.name == "Home"
    assert workspace.workspace_type.value == "household"
    membership = session.added[1]
    assert isinstance(membership, WorkspaceMembership)
    assert membership.workspace_id == workspace.id
    assert membership.user_id == user_id
    assert membership.role is WorkspaceRole.OWNER
    session.commit.assert_awaited_once()


async def test_create_workspace_rejects_blank_names() -> None:
    session = WorkspaceSession()
    with pytest.raises(InvalidWorkspace):
        await create_workspace(
            session, ActorContext(user_id=uuid4(), client="test"), CreateWorkspace("   ")
        )
    assert session.added == []


async def test_create_workspace_rolls_back_partial_state() -> None:
    session = WorkspaceSession()
    session.commit.side_effect = RuntimeError("commit failed")
    with pytest.raises(RuntimeError):
        await create_workspace(
            session, ActorContext(user_id=uuid4(), client="test"), CreateWorkspace("Home")
        )
    session.rollback.assert_awaited_once()
