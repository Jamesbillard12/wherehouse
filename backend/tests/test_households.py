from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.application.context import ActorContext
from app.application.households.capabilities import (
    CreateHousehold,
    InvalidHousehold,
    create_household,
)
from app.models import Household, HouseholdRelationship, HouseholdUser


class HouseholdSession:
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


async def test_create_household_atomically_adds_owner_membership() -> None:
    user_id = uuid4()
    session = HouseholdSession()

    household = await create_household(
        session, ActorContext(user_id=user_id, client="test"), CreateHousehold("  Home  ")
    )

    assert isinstance(household, Household)
    assert household.name == "Home"
    membership = session.added[1]
    assert isinstance(membership, HouseholdUser)
    assert membership.household_id == household.id
    assert membership.user_id == user_id
    assert membership.relationship_type is HouseholdRelationship.OWNER
    session.commit.assert_awaited_once()


async def test_create_household_rejects_blank_names() -> None:
    session = HouseholdSession()
    with pytest.raises(InvalidHousehold):
        await create_household(
            session, ActorContext(user_id=uuid4(), client="test"), CreateHousehold("   ")
        )
    assert session.added == []


async def test_create_household_rolls_back_partial_state() -> None:
    session = HouseholdSession()
    session.commit.side_effect = RuntimeError("commit failed")
    with pytest.raises(RuntimeError):
        await create_household(
            session, ActorContext(user_id=uuid4(), client="test"), CreateHousehold("Home")
        )
    session.rollback.assert_awaited_once()
