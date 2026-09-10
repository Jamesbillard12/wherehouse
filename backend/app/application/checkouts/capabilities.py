from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.context import ActorContext
from app.models import (
    BorrowerProfile,
    Checkout,
    CheckoutSession,
    CheckoutSessionItem,
    CheckoutSessionStatus,
    Item,
    WorkspaceMembership,
    WorkspaceRole,
)


class CheckoutError(Exception):
    pass


class CheckoutAccessDenied(CheckoutError):
    pass


class CheckoutConflict(CheckoutError):
    pass


class CheckoutNotFound(CheckoutError):
    pass


class CheckoutRevisionConflict(CheckoutConflict):
    pass


class CheckoutItemsConflict(CheckoutConflict):
    def __init__(self, item_ids: list[UUID]):
        super().__init__("One or more items are unavailable")
        self.item_ids = item_ids


@dataclass(frozen=True)
class CreateCheckout:
    workspace_id: UUID
    item_id: UUID
    borrower_profile_id: UUID | None
    due_at: datetime | None = None
    notes: str | None = None


async def _membership(session: AsyncSession, actor: ActorContext, workspace_id: UUID):
    membership = await session.scalar(
        select(WorkspaceMembership).where(
            WorkspaceMembership.workspace_id == workspace_id,
            WorkspaceMembership.user_id == actor.user_id,
        )
    )
    if membership is None or (
        actor.workspace_id is not None and actor.workspace_id != workspace_id
    ):
        raise CheckoutAccessDenied("Workspace access denied")
    return membership


async def create_checkout(
    session: AsyncSession, actor: ActorContext, command: CreateCheckout
) -> Checkout:
    membership = await _membership(session, actor, command.workspace_id)
    item = await session.get(Item, command.item_id)
    if item is None or item.workspace_id != command.workspace_id or item.is_archived:
        raise CheckoutNotFound("Item is unavailable")
    if membership.role is WorkspaceRole.OWNER:
        if command.borrower_profile_id is None:
            raise CheckoutError("A borrower is required")
        borrower = await session.get(BorrowerProfile, command.borrower_profile_id)
    else:
        if command.borrower_profile_id is not None:
            raise CheckoutAccessDenied("Borrowers may only check out items to themselves")
        borrower = await session.scalar(
            select(BorrowerProfile).where(
                BorrowerProfile.workspace_id == command.workspace_id,
                BorrowerProfile.linked_user_id == actor.user_id,
            )
        )
    if borrower is None or borrower.workspace_id != command.workspace_id:
        raise CheckoutAccessDenied("Borrower profile is unavailable")
    active = await session.scalar(
        select(Checkout.id).where(Checkout.item_id == item.id, Checkout.returned_at.is_(None))
    )
    if active is not None:
        raise CheckoutConflict("Item is already checked out")
    checkout = Checkout(
        workspace_id=command.workspace_id,
        item_id=item.id,
        borrower_profile_id=borrower.id,
        due_at=command.due_at,
        checkout_notes=command.notes,
        checked_out_by_user_id=actor.user_id,
    )
    session.add(checkout)
    await session.commit()
    await session.refresh(checkout)
    return checkout


async def return_checkout(
    session: AsyncSession, actor: ActorContext, checkout_id: UUID, notes: str | None
) -> Checkout:
    checkout = await session.scalar(
        select(Checkout).where(Checkout.id == checkout_id).with_for_update()
    )
    if checkout is None:
        raise CheckoutNotFound("Checkout not found")
    membership = await _membership(session, actor, checkout.workspace_id)
    if checkout.returned_at is not None:
        raise CheckoutConflict("Item has already been returned")
    if membership.role is not WorkspaceRole.OWNER:
        borrower = await session.get(BorrowerProfile, checkout.borrower_profile_id)
        if borrower is None or borrower.linked_user_id != actor.user_id:
            raise CheckoutAccessDenied("Borrowers may only return their own checkouts")
    checkout.returned_at = datetime.now(UTC)
    checkout.returned_by_user_id = actor.user_id
    checkout.return_notes = notes
    await session.commit()
    await session.refresh(checkout)
    return checkout


async def get_or_create_active_session(
    session: AsyncSession, actor: ActorContext, workspace_id: UUID
) -> CheckoutSession:
    membership = await _membership(session, actor, workspace_id)
    current = await session.scalar(
        select(CheckoutSession).where(
            CheckoutSession.workspace_id == workspace_id,
            CheckoutSession.actor_user_id == actor.user_id,
            CheckoutSession.status == CheckoutSessionStatus.ACTIVE,
        )
    )
    if current is not None:
        return current
    borrower_id = None
    if membership.role is WorkspaceRole.BORROWER:
        borrower = await session.scalar(
            select(BorrowerProfile).where(
                BorrowerProfile.workspace_id == workspace_id,
                BorrowerProfile.linked_user_id == actor.user_id,
            )
        )
        if borrower is None:
            raise CheckoutAccessDenied("No linked borrower profile is available")
        borrower_id = borrower.id
    current = CheckoutSession(
        workspace_id=workspace_id,
        actor_user_id=actor.user_id,
        borrower_profile_id=borrower_id,
        status=CheckoutSessionStatus.ACTIVE,
        revision=1,
    )
    session.add(current)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        current = await session.scalar(
            select(CheckoutSession).where(
                CheckoutSession.workspace_id == workspace_id,
                CheckoutSession.actor_user_id == actor.user_id,
                CheckoutSession.status == CheckoutSessionStatus.ACTIVE,
            )
        )
        if current is None:
            raise
        return current
    await session.refresh(current)
    return current


async def require_editable_session(
    session: AsyncSession, actor: ActorContext, session_id: UUID, *, lock: bool = False
) -> tuple[CheckoutSession, WorkspaceMembership]:
    query = select(CheckoutSession).where(CheckoutSession.id == session_id)
    current = await session.scalar(query.with_for_update() if lock else query)
    if current is None or current.status is not CheckoutSessionStatus.ACTIVE:
        raise CheckoutNotFound("Active checkout session not found")
    membership = await _membership(session, actor, current.workspace_id)
    if current.actor_user_id != actor.user_id:
        raise CheckoutAccessDenied("Another user's checkout session is view-only")
    return current, membership


async def update_active_session(
    session: AsyncSession,
    actor: ActorContext,
    session_id: UUID,
    *,
    borrower_profile_id: UUID | None,
    due_at: datetime | None,
    note: str | None,
    expected_revision: int,
) -> CheckoutSession:
    current, membership = await require_editable_session(session, actor, session_id, lock=True)
    if current.revision != expected_revision:
        raise CheckoutRevisionConflict("Checkout session changed on another device")
    if membership.role is WorkspaceRole.BORROWER:
        borrower = await session.get(BorrowerProfile, current.borrower_profile_id)
        if (
            borrower is None
            or borrower.linked_user_id != actor.user_id
            or borrower_profile_id not in (None, borrower.id)
        ):
            raise CheckoutAccessDenied("Borrowers may only check out to themselves")
        borrower_profile_id = borrower.id
    elif borrower_profile_id is not None:
        borrower = await session.get(BorrowerProfile, borrower_profile_id)
        if borrower is None or borrower.workspace_id != current.workspace_id:
            raise CheckoutAccessDenied("Borrower profile is unavailable")
    current.borrower_profile_id = borrower_profile_id
    current.due_at = due_at
    current.note = note
    current.revision += 1
    await session.commit()
    await session.refresh(current)
    return current


async def add_session_item(
    session: AsyncSession, actor: ActorContext, session_id: UUID, item_id: UUID
) -> CheckoutSession:
    current, _ = await require_editable_session(session, actor, session_id, lock=True)
    item = await session.get(Item, item_id)
    if item is None or item.workspace_id != current.workspace_id or item.is_archived:
        raise CheckoutNotFound("Item is unavailable")
    active_checkout = await session.scalar(
        select(Checkout.id).where(Checkout.item_id == item_id, Checkout.returned_at.is_(None))
    )
    if active_checkout is not None:
        raise CheckoutConflict("Item is already checked out; return or view it instead")
    existing = await session.scalar(
        select(CheckoutSessionItem.id).where(
            CheckoutSessionItem.checkout_session_id == current.id,
            CheckoutSessionItem.item_id == item_id,
        )
    )
    if existing is None:
        session.add(
            CheckoutSessionItem(
                checkout_session_id=current.id,
                item_id=item_id,
                added_by_user_id=actor.user_id,
                added_by_device_id=actor.device_id,
            )
        )
        current.revision += 1
        await session.commit()
        await session.refresh(current)
    return current


async def remove_session_item(
    session: AsyncSession, actor: ActorContext, session_id: UUID, item_id: UUID
) -> CheckoutSession:
    current, _ = await require_editable_session(session, actor, session_id, lock=True)
    entry = await session.scalar(
        select(CheckoutSessionItem).where(
            CheckoutSessionItem.checkout_session_id == current.id,
            CheckoutSessionItem.item_id == item_id,
        )
    )
    if entry is not None:
        await session.delete(entry)
        current.revision += 1
        await session.commit()
        await session.refresh(current)
    return current


async def abandon_session(
    session: AsyncSession, actor: ActorContext, session_id: UUID
) -> CheckoutSession:
    current, _ = await require_editable_session(session, actor, session_id, lock=True)
    current.status = CheckoutSessionStatus.ABANDONED
    current.abandoned_at = datetime.now(UTC)
    current.revision += 1
    await session.commit()
    await session.refresh(current)
    return current


async def finalize_session(
    session: AsyncSession, actor: ActorContext, session_id: UUID, expected_revision: int
) -> tuple[CheckoutSession, list[Checkout]]:
    current, membership = await require_editable_session(session, actor, session_id, lock=True)
    if current.revision != expected_revision:
        raise CheckoutRevisionConflict("Checkout session changed on another device")
    if current.borrower_profile_id is None:
        raise CheckoutError("Select a borrower before checkout")
    borrower = await session.get(BorrowerProfile, current.borrower_profile_id)
    if borrower is None or borrower.workspace_id != current.workspace_id:
        raise CheckoutAccessDenied("Borrower profile is unavailable")
    if membership.role is WorkspaceRole.BORROWER and borrower.linked_user_id != actor.user_id:
        raise CheckoutAccessDenied("Borrowers may only check out to themselves")
    item_ids = list(
        await session.scalars(
            select(CheckoutSessionItem.item_id).where(
                CheckoutSessionItem.checkout_session_id == current.id
            )
        )
    )
    if not item_ids:
        raise CheckoutError("Add at least one item before checkout")
    items = list(
        await session.scalars(
            select(Item)
            .where(Item.id.in_(sorted(item_ids, key=str)))
            .order_by(Item.id)
            .with_for_update()
        )
    )
    valid_ids = {
        item.id
        for item in items
        if item.workspace_id == current.workspace_id and not item.is_archived
    }
    active_ids = set(
        await session.scalars(
            select(Checkout.item_id).where(
                Checkout.item_id.in_(item_ids), Checkout.returned_at.is_(None)
            )
        )
    )
    conflicts = sorted(set(item_ids) - valid_ids | active_ids, key=str)
    if conflicts:
        raise CheckoutItemsConflict(conflicts)
    checkouts = [
        Checkout(
            workspace_id=current.workspace_id,
            item_id=item_id,
            borrower_profile_id=borrower.id,
            due_at=current.due_at,
            checkout_notes=current.note,
            checked_out_by_user_id=actor.user_id,
        )
        for item_id in item_ids
    ]
    session.add_all(checkouts)
    current.status = CheckoutSessionStatus.COMPLETED
    current.completed_at = datetime.now(UTC)
    current.revision += 1
    await session.commit()
    for checkout in checkouts:
        await session.refresh(checkout)
    await session.refresh(current)
    return current, checkouts
