from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.application.checkouts.capabilities import (
    CheckoutAccessDenied,
    CheckoutConflict,
    CheckoutItemsConflict,
    CreateCheckout,
    create_checkout,
    finalize_session,
    return_checkout,
)
from app.application.context import ActorContext
from app.models import (
    BorrowerProfile,
    Checkout,
    CheckoutSession,
    CheckoutSessionStatus,
    Item,
    WorkspaceRole,
)


class Session:
    def __init__(self, *, scalars=(), gets=None):
        self.scalars = list(scalars)
        self.gets = gets or {}
        self.added = []
        self.commit = AsyncMock()
        self.refresh = AsyncMock()

    async def scalar(self, _query):
        return self.scalars.pop(0)

    async def get(self, model, identifier):
        return self.gets.get((model, identifier))

    def add(self, value):
        self.added.append(value)


def actor(user_id, workspace_id=None):
    return ActorContext(user_id=user_id, client="test", workspace_id=workspace_id)


async def test_owner_checkout_preserves_borrower_and_action_actor() -> None:
    workspace_id, owner_id, borrower_id, item_id = uuid4(), uuid4(), uuid4(), uuid4()
    item = SimpleNamespace(id=item_id, workspace_id=workspace_id, is_archived=False)
    borrower = SimpleNamespace(id=borrower_id, workspace_id=workspace_id)
    session = Session(
        scalars=[SimpleNamespace(role=WorkspaceRole.OWNER), None],
        gets={(Item, item_id): item, (BorrowerProfile, borrower_id): borrower},
    )
    checkout = await create_checkout(
        session, actor(owner_id), CreateCheckout(workspace_id, item_id, borrower_id)
    )
    assert checkout.borrower_profile_id == borrower_id
    assert checkout.checked_out_by_user_id == owner_id
    session.commit.assert_awaited_once()


async def test_borrower_checkout_is_derived_and_cannot_target_another_profile() -> None:
    workspace_id, user_id, borrower_id, item_id = uuid4(), uuid4(), uuid4(), uuid4()
    item = SimpleNamespace(id=item_id, workspace_id=workspace_id, is_archived=False)
    borrower = SimpleNamespace(id=borrower_id, workspace_id=workspace_id, linked_user_id=user_id)
    session = Session(
        scalars=[SimpleNamespace(role=WorkspaceRole.BORROWER), borrower, None],
        gets={(Item, item_id): item},
    )
    checkout = await create_checkout(
        session, actor(user_id), CreateCheckout(workspace_id, item_id, None)
    )
    assert checkout.borrower_profile_id == borrower_id
    with pytest.raises(CheckoutAccessDenied):
        await create_checkout(
            Session(
                scalars=[SimpleNamespace(role=WorkspaceRole.BORROWER)], gets={(Item, item_id): item}
            ),
            actor(user_id),
            CreateCheckout(workspace_id, item_id, uuid4()),
        )


async def test_duplicate_active_checkout_is_rejected() -> None:
    workspace_id, owner_id, borrower_id, item_id = uuid4(), uuid4(), uuid4(), uuid4()
    item = SimpleNamespace(id=item_id, workspace_id=workspace_id, is_archived=False)
    borrower = SimpleNamespace(id=borrower_id, workspace_id=workspace_id)
    session = Session(
        scalars=[SimpleNamespace(role=WorkspaceRole.OWNER), uuid4()],
        gets={(Item, item_id): item, (BorrowerProfile, borrower_id): borrower},
    )
    with pytest.raises(CheckoutConflict):
        await create_checkout(
            session, actor(owner_id), CreateCheckout(workspace_id, item_id, borrower_id)
        )


async def test_linked_borrower_may_return_own_checkout_but_not_anothers() -> None:
    workspace_id, borrower_id, borrower_user = uuid4(), uuid4(), uuid4()
    checkout = Checkout(
        workspace_id=workspace_id,
        item_id=uuid4(),
        borrower_profile_id=borrower_id,
        checked_out_by_user_id=uuid4(),
    )
    checkout.id = uuid4()
    profile = SimpleNamespace(id=borrower_id, linked_user_id=borrower_user)
    session = Session(
        scalars=[checkout, SimpleNamespace(role=WorkspaceRole.BORROWER)],
        gets={(BorrowerProfile, borrower_id): profile},
    )
    returned = await return_checkout(session, actor(borrower_user), checkout.id, "All good")
    assert returned.returned_by_user_id == borrower_user
    assert returned.return_notes == "All good"
    another = Checkout(
        workspace_id=workspace_id,
        item_id=uuid4(),
        borrower_profile_id=borrower_id,
        checked_out_by_user_id=uuid4(),
    )
    another.id = uuid4()
    denied = Session(
        scalars=[another, SimpleNamespace(role=WorkspaceRole.BORROWER)],
        gets={(BorrowerProfile, borrower_id): profile},
    )
    with pytest.raises(CheckoutAccessDenied):
        await return_checkout(denied, actor(uuid4()), another.id, None)


class FinalizeSession:
    def __init__(self, current, membership, borrower, item_ids, items, active_ids=()):
        self.scalar_values = [current, membership]
        self.scalars_values = [item_ids, items, active_ids]
        self.borrower = borrower
        self.added = []
        self.commit = AsyncMock()
        self.refresh = AsyncMock()

    async def scalar(self, _query):
        return self.scalar_values.pop(0)

    async def scalars(self, _query):
        return self.scalars_values.pop(0)

    async def get(self, model, _identifier):
        return self.borrower if model is BorrowerProfile else None

    def add_all(self, values):
        self.added.extend(values)


async def test_multi_item_finalize_is_all_or_none_and_preserves_actor_attribution() -> None:
    workspace_id, owner_id, borrower_id = uuid4(), uuid4(), uuid4()
    item_ids = [uuid4(), uuid4()]
    current = CheckoutSession(
        workspace_id=workspace_id,
        actor_user_id=owner_id,
        borrower_profile_id=borrower_id,
        status=CheckoutSessionStatus.ACTIVE,
        revision=4,
    )
    current.id = uuid4()
    borrower = SimpleNamespace(id=borrower_id, workspace_id=workspace_id)
    items = [
        SimpleNamespace(id=value, workspace_id=workspace_id, is_archived=False)
        for value in item_ids
    ]
    session = FinalizeSession(
        current, SimpleNamespace(role=WorkspaceRole.OWNER), borrower, item_ids, items
    )

    completed, checkouts = await finalize_session(session, actor(owner_id), current.id, 4)

    assert len(checkouts) == 2
    assert {entry.item_id for entry in checkouts} == set(item_ids)
    assert all(entry.borrower_profile_id == borrower_id for entry in checkouts)
    assert all(entry.checked_out_by_user_id == owner_id for entry in checkouts)
    assert completed.status is CheckoutSessionStatus.COMPLETED
    session.commit.assert_awaited_once()


async def test_multi_item_finalize_keeps_session_intact_on_conflict() -> None:
    workspace_id, owner_id, borrower_id = uuid4(), uuid4(), uuid4()
    item_ids = [uuid4(), uuid4()]
    current = CheckoutSession(
        workspace_id=workspace_id,
        actor_user_id=owner_id,
        borrower_profile_id=borrower_id,
        status=CheckoutSessionStatus.ACTIVE,
        revision=2,
    )
    current.id = uuid4()
    borrower = SimpleNamespace(id=borrower_id, workspace_id=workspace_id)
    items = [
        SimpleNamespace(id=value, workspace_id=workspace_id, is_archived=False)
        for value in item_ids
    ]
    session = FinalizeSession(
        current, SimpleNamespace(role=WorkspaceRole.OWNER), borrower, item_ids, items, [item_ids[1]]
    )

    with pytest.raises(CheckoutItemsConflict) as error:
        await finalize_session(session, actor(owner_id), current.id, 2)

    assert error.value.item_ids == [item_ids[1]]
    assert current.status is CheckoutSessionStatus.ACTIVE
    assert session.added == []
    session.commit.assert_not_awaited()
