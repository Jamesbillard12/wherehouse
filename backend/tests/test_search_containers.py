from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.application.context import ActorContext
from app.application.locations.capabilities import (
    LocationAccessDenied,
    SearchContainers,
    search_containers,
)
from app.models import Area, Container, ContainerPlacement, Zone


class SearchSession:
    def __init__(self, membership, scalar_results=()):
        self.membership = membership
        self.scalar_results = iter(scalar_results)
        self.statement = None

    async def scalar(self, _statement):
        return self.membership

    async def scalars(self, statement):
        if self.statement is None:
            self.statement = statement
        return next(self.scalar_results)


def actor(workspace_id=None):
    return ActorContext(user_id=uuid4(), client="test", workspace_id=workspace_id)


async def test_container_search_returns_canonical_nested_path() -> None:
    workspace_id = uuid4()
    area = Area(id=uuid4(), workspace_id=workspace_id, name="Garage", icon="warehouse")
    zone = Zone(id=uuid4(), area_id=area.id, name="North Wall")
    shelf = Container(id=uuid4(), area_id=area.id, zone_id=zone.id, name="Shelf", code="SHF-001", container_type="shelf", is_archived=False)
    box = Container(id=uuid4(), area_id=area.id, zone_id=zone.id, name="Yellow Bin", code="BIN-001", container_type="bin", is_archived=False)
    placement = ContainerPlacement(container_id=box.id, parent_container_id=shelf.id, relationship_type="on")
    session = SearchSession(SimpleNamespace(), [[box], [area], [zone], [shelf, box], [placement]])

    results = await search_containers(session, actor(), workspace_id, SearchContainers("yellow"))

    assert results[0].container is box
    assert results[0].resolved_path == "Garage > North Wall > Shelf > Yellow Bin"
    sql = str(session.statement)
    assert "areas.workspace_id" in sql
    assert "containers.is_archived IS false" in sql


async def test_container_search_enforces_workspace_context() -> None:
    session = SearchSession(SimpleNamespace())
    with pytest.raises(LocationAccessDenied):
        await search_containers(session, actor(uuid4()), uuid4(), SearchContainers("bin"))


async def test_empty_container_search_does_not_query_inventory() -> None:
    session = SearchSession(SimpleNamespace())
    assert await search_containers(session, actor(), uuid4(), SearchContainers("  ")) == []
    assert session.statement is None
