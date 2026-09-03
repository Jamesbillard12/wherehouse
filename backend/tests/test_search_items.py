from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.application.context import ActorContext
from app.application.items.capabilities import (
    SearchItems,
    WorkspaceAccessDenied,
    normalize_search_query,
    search_items,
)
from app.models import Item


class Rows:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class SearchSession:
    def __init__(self, membership, rows=()):
        self.membership = membership
        self.rows = rows
        self.statement = None

    async def scalar(self, _statement):
        return self.membership

    async def execute(self, statement):
        self.statement = statement
        return Rows(self.rows)


def actor(workspace_id=None):
    return ActorContext(user_id=uuid4(), client="test", workspace_id=workspace_id)


def test_query_normalization_is_case_and_whitespace_tolerant() -> None:
    assert normalize_search_query("  CAMPING\t  Stove \n") == "camping stove"


async def test_empty_query_is_safe_and_does_not_scan() -> None:
    session = SearchSession(SimpleNamespace())
    assert await search_items(session, actor(), uuid4(), SearchItems(" \t ")) == []
    assert session.statement is None


async def test_search_enforces_actor_workspace_before_querying() -> None:
    session = SearchSession(SimpleNamespace())
    with pytest.raises(WorkspaceAccessDenied):
        await search_items(session, actor(uuid4()), uuid4(), SearchItems("stove"))
    assert session.statement is None


async def test_search_returns_active_projection_and_escapes_wildcards() -> None:
    workspace_id = uuid4()
    item = Item(
        id=uuid4(),
        workspace_id=workspace_id,
        name="100% Camp Stove",
        code="ITM-001",
        quantity=1,
        is_archived=False,
    )
    session = SearchSession(SimpleNamespace(), [(item, None)])

    matches = await search_items(session, actor(), workspace_id, SearchItems("100%_"))

    assert [match.item for match in matches] == [item]
    assert matches[0].resolved_path is None
    assert session.statement is not None
    assert any("100\\%\\_" in str(value) for value in session.statement.compile().params.values())
    sql = str(session.statement)
    assert "items.workspace_id" in sql
    assert "items.is_archived IS false" in sql


async def test_search_rejects_excessively_long_input() -> None:
    with pytest.raises(ValueError, match="at most 200"):
        await search_items(SearchSession(SimpleNamespace()), actor(), uuid4(), SearchItems("x" * 201))
