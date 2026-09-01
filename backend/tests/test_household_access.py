from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api.dependencies import Principal, require_household_access
from app.models import HouseholdRelationship


class MembershipSession:
    def __init__(self, membership):
        self.membership = membership

    async def scalar(self, _query):
        return self.membership


@pytest.mark.asyncio
async def test_device_can_use_another_household_where_its_user_is_a_member() -> None:
    user = SimpleNamespace(id=uuid4())
    principal = Principal(
        user=user,
        method="device",
        device_id=uuid4(),
        device_household_id=uuid4(),
    )
    membership = SimpleNamespace(relationship_type=HouseholdRelationship.BORROWER)

    assert await require_household_access(uuid4(), principal, MembershipSession(membership)) is membership


@pytest.mark.asyncio
async def test_owner_action_still_rejects_non_owner_membership() -> None:
    principal = Principal(user=SimpleNamespace(id=uuid4()), method="user_session")
    membership = SimpleNamespace(relationship_type=HouseholdRelationship.BORROWER)

    with pytest.raises(HTTPException) as error:
        await require_household_access(
            uuid4(), principal, MembershipSession(membership), owner=True
        )

    assert error.value.status_code == 403
