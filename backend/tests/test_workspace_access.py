from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api.dependencies import Principal, require_workspace_access
from app.api.v1.routes import items, workspaces
from app.models import WorkspaceRole


class MembershipSession:
    def __init__(self, membership):
        self.membership = membership

    async def scalar(self, _query):
        return self.membership


@pytest.mark.asyncio
async def test_device_can_use_its_paired_workspace_membership() -> None:
    user = SimpleNamespace(id=uuid4())
    workspace_id = uuid4()
    principal = Principal(
        user=user,
        method="device",
        device_id=uuid4(),
        device_workspace_id=workspace_id,
    )
    membership = SimpleNamespace(role=WorkspaceRole.BORROWER)

    assert (
        await require_workspace_access(
            workspace_id, principal, MembershipSession(membership)
        )
        is membership
    )


@pytest.mark.asyncio
async def test_owner_action_still_rejects_non_owner_membership() -> None:
    principal = Principal(user=SimpleNamespace(id=uuid4()), method="user_session")
    membership = SimpleNamespace(role=WorkspaceRole.BORROWER)

    with pytest.raises(HTTPException) as error:
        await require_workspace_access(
            uuid4(), principal, MembershipSession(membership), owner=True
        )

    assert error.value.status_code == 403


def test_legacy_household_routes_remain_available_during_v1_transition() -> None:
    paths = {route.path for route in [*workspaces.router.routes, *items.router.routes]}
    assert "/workspaces" in paths
    assert "/households" in paths
    assert "/workspaces/{workspace_id}/items" in paths
    assert "/households/{workspace_id}/items" in paths


@pytest.mark.asyncio
async def test_device_credential_cannot_cross_workspace_memberships() -> None:
    workspace_a, workspace_b = uuid4(), uuid4()
    principal = Principal(
        user=SimpleNamespace(id=uuid4()),
        method="device",
        device_id=uuid4(),
        device_workspace_id=workspace_a,
    )
    membership = SimpleNamespace(role=WorkspaceRole.OWNER)

    with pytest.raises(HTTPException) as error:
        await require_workspace_access(
            workspace_b, principal, MembershipSession(membership)
        )

    assert error.value.status_code == 403
