from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.context import ActorContext
from app.models import BorrowerProfile, Checkout, Item, WorkspaceMembership, WorkspaceRole


class CheckoutError(Exception):
    pass


class CheckoutAccessDenied(CheckoutError):
    pass


class CheckoutConflict(CheckoutError):
    pass


class CheckoutNotFound(CheckoutError):
    pass


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
