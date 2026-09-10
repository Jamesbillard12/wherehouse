from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode
from uuid import UUID

from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.dependencies import PrincipalDep, SessionDep, require_workspace_access
from app.application.checkouts.capabilities import (
    CheckoutAccessDenied,
    CheckoutConflict,
    CheckoutError,
    CheckoutNotFound,
    CreateCheckout,
    create_checkout,
    return_checkout,
)
from app.application.context import ActorContext
from app.core.config import get_settings
from app.core.security import hash_password, new_token, token_hash, verify_password
from app.models import (
    BorrowerInvitation,
    BorrowerProfile,
    Checkout,
    Device,
    Item,
    User,
    Workspace,
    WorkspaceMembership,
    WorkspaceRole,
)
from app.schemas.checkouts import (
    BorrowerCreate,
    BorrowerRead,
    BorrowerUpdate,
    CheckoutCreate,
    CheckoutRead,
    CheckoutReturn,
    InvitationClaim,
    InvitationClaimResult,
    InvitationRead,
)
from app.services.realtime import realtime_hub

router = APIRouter()
settings = get_settings()


def actor(principal: PrincipalDep, workspace_id: UUID | None = None) -> ActorContext:
    return ActorContext(
        user_id=principal.user.id,
        client=principal.method,
        device_id=principal.device_id,
        workspace_id=workspace_id or principal.device_workspace_id,
    )


def normalize_email(value: str | None) -> str | None:
    return value.strip().lower() if value and value.strip() else None


@router.get("/workspaces/{workspace_id}/borrowers", response_model=list[BorrowerRead])
async def list_borrowers(workspace_id: UUID, principal: PrincipalDep, session: SessionDep):
    await require_workspace_access(workspace_id, principal, session, owner=True)
    return list(
        await session.scalars(
            select(BorrowerProfile)
            .where(BorrowerProfile.workspace_id == workspace_id)
            .order_by(BorrowerProfile.display_name)
        )
    )


@router.post("/workspaces/{workspace_id}/borrowers", response_model=BorrowerRead, status_code=201)
async def add_borrower(
    workspace_id: UUID, payload: BorrowerCreate, principal: PrincipalDep, session: SessionDep
):
    await require_workspace_access(workspace_id, principal, session, owner=True)
    borrower = BorrowerProfile(
        workspace_id=workspace_id,
        display_name=payload.display_name.strip(),
        email=normalize_email(payload.email),
        created_by_user_id=principal.user.id,
    )
    session.add(borrower)
    await session.commit()
    await session.refresh(borrower)
    return borrower


@router.patch("/workspaces/{workspace_id}/borrowers/{borrower_id}", response_model=BorrowerRead)
async def edit_borrower(
    workspace_id: UUID,
    borrower_id: UUID,
    payload: BorrowerUpdate,
    principal: PrincipalDep,
    session: SessionDep,
):
    await require_workspace_access(workspace_id, principal, session, owner=True)
    borrower = await session.scalar(
        select(BorrowerProfile).where(BorrowerProfile.id == borrower_id).with_for_update()
    )
    if borrower is None or borrower.workspace_id != workspace_id:
        raise HTTPException(404, "Borrower not found")
    email = normalize_email(payload.email)
    if borrower.linked_user_id and email != borrower.email:
        raise HTTPException(
            409, "A linked account email cannot be changed through borrower editing"
        )
    active_invite = await session.scalar(
        select(BorrowerInvitation.id).where(
            BorrowerInvitation.borrower_profile_id == borrower.id,
            BorrowerInvitation.consumed_at.is_(None),
            BorrowerInvitation.revoked_at.is_(None),
            BorrowerInvitation.expires_at > datetime.now(UTC),
        )
    )
    if active_invite and email != borrower.email:
        raise HTTPException(409, "Revoke the active invitation before changing the email")
    borrower.display_name = payload.display_name.strip()
    borrower.email = email
    await session.commit()
    await session.refresh(borrower)
    return borrower


@router.post(
    "/workspaces/{workspace_id}/borrowers/{borrower_id}/invitations",
    response_model=InvitationRead,
    status_code=201,
)
async def invite_borrower(
    workspace_id: UUID, borrower_id: UUID, principal: PrincipalDep, session: SessionDep
):
    await require_workspace_access(workspace_id, principal, session, owner=True)
    borrower = await session.scalar(
        select(BorrowerProfile).where(BorrowerProfile.id == borrower_id).with_for_update()
    )
    workspace = await session.get(Workspace, workspace_id)
    if borrower is None or borrower.workspace_id != workspace_id or workspace is None:
        raise HTTPException(404, "Borrower not found")
    if borrower.linked_user_id:
        raise HTTPException(409, "Self-service is already enabled")
    if not borrower.email:
        raise HTTPException(409, "Add an email before enabling self-service")
    now = datetime.now(UTC)
    for current in await session.scalars(
        select(BorrowerInvitation).where(
            BorrowerInvitation.borrower_profile_id == borrower.id,
            BorrowerInvitation.consumed_at.is_(None),
            BorrowerInvitation.revoked_at.is_(None),
        )
    ):
        current.revoked_at = now
    raw_token = new_token("invite")
    invitation = BorrowerInvitation(
        workspace_id=workspace_id,
        borrower_profile_id=borrower.id,
        invited_email=borrower.email,
        token_hash=token_hash(raw_token),
        expires_at=now + timedelta(hours=24),
        created_by_user_id=principal.user.id,
    )
    session.add(invitation)
    await session.commit()
    uri = "wherehouse://join?" + urlencode(
        {"server": settings.public_base_url.rstrip("/"), "invite": raw_token}
    )
    return InvitationRead(
        id=invitation.id,
        borrower_profile_id=borrower.id,
        workspace_id=workspace_id,
        workspace_name=workspace.name,
        borrower_name=borrower.display_name,
        invited_email=invitation.invited_email,
        expires_at=invitation.expires_at,
        invite_uri=uri,
    )


@router.get(
    "/workspaces/{workspace_id}/borrower-invitations",
    response_model=list[InvitationRead],
)
async def list_invitations(workspace_id: UUID, principal: PrincipalDep, session: SessionDep):
    await require_workspace_access(workspace_id, principal, session, owner=True)
    invitations = list(
        await session.scalars(
            select(BorrowerInvitation).where(
                BorrowerInvitation.workspace_id == workspace_id,
                BorrowerInvitation.consumed_at.is_(None),
                BorrowerInvitation.revoked_at.is_(None),
                BorrowerInvitation.expires_at > datetime.now(UTC),
            )
        )
    )
    return [await invitation_details(invitation, session) for invitation in invitations]


@router.delete("/workspaces/{workspace_id}/borrower-invitations/{invitation_id}", status_code=204)
async def revoke_invitation(
    workspace_id: UUID, invitation_id: UUID, principal: PrincipalDep, session: SessionDep
):
    await require_workspace_access(workspace_id, principal, session, owner=True)
    invitation = await session.get(BorrowerInvitation, invitation_id)
    if invitation is None or invitation.workspace_id != workspace_id:
        raise HTTPException(404, "Invitation not found")
    invitation.revoked_at = datetime.now(UTC)
    await session.commit()


async def invitation_details(
    invitation: BorrowerInvitation, session: SessionDep, *, uri: str | None = None
) -> InvitationRead:
    borrower = await session.get(BorrowerProfile, invitation.borrower_profile_id)
    workspace = await session.get(Workspace, invitation.workspace_id)
    assert borrower and workspace
    return InvitationRead(
        id=invitation.id,
        borrower_profile_id=borrower.id,
        workspace_id=workspace.id,
        workspace_name=workspace.name,
        borrower_name=borrower.display_name,
        invited_email=invitation.invited_email,
        expires_at=invitation.expires_at,
        invite_uri=uri,
    )


@router.get("/borrower-invitations/{token}", response_model=InvitationRead)
async def inspect_invitation(token: str, session: SessionDep):
    invitation = await session.scalar(
        select(BorrowerInvitation).where(BorrowerInvitation.token_hash == token_hash(token))
    )
    if (
        invitation is None
        or invitation.consumed_at
        or invitation.revoked_at
        or invitation.expires_at <= datetime.now(UTC)
    ):
        raise HTTPException(400, "Invitation is invalid or expired")
    return await invitation_details(invitation, session)


@router.post("/borrower-invitations/claim", response_model=InvitationClaimResult)
async def claim_invitation(payload: InvitationClaim, session: SessionDep):
    now = datetime.now(UTC)
    invitation = await session.scalar(
        select(BorrowerInvitation)
        .where(BorrowerInvitation.token_hash == token_hash(payload.token))
        .with_for_update()
    )
    if (
        invitation is None
        or invitation.consumed_at
        or invitation.revoked_at
        or invitation.expires_at <= now
    ):
        raise HTTPException(400, "Invitation is invalid or expired")
    borrower = await session.get(BorrowerProfile, invitation.borrower_profile_id)
    if borrower is None or borrower.linked_user_id:
        raise HTTPException(409, "Borrower is already linked")
    user = await session.scalar(select(User).where(User.email == invitation.invited_email))
    if user:
        if user.password_hash is None or not verify_password(payload.password, user.password_hash):
            raise HTTPException(401, "Sign in with the invited account")
    else:
        if not payload.display_name or not payload.display_name.strip():
            raise HTTPException(422, "Display name is required for a new account")
        user = User(
            email=invitation.invited_email,
            display_name=payload.display_name.strip(),
            password_hash=hash_password(payload.password),
        )
        session.add(user)
        await session.flush()
    membership = await session.scalar(
        select(WorkspaceMembership).where(
            WorkspaceMembership.workspace_id == invitation.workspace_id,
            WorkspaceMembership.user_id == user.id,
        )
    )
    if membership is None:
        session.add(
            WorkspaceMembership(
                workspace_id=invitation.workspace_id, user_id=user.id, role=WorkspaceRole.BORROWER
            )
        )
    borrower.linked_user_id = user.id
    credential = new_token("dev")
    device = Device(
        workspace_id=invitation.workspace_id,
        user_id=user.id,
        name=payload.device_name.strip(),
        device_type=payload.device_type,
        credential_hash=token_hash(credential),
        last_seen_at=now,
    )
    session.add(device)
    await session.flush()
    invitation.consumed_at = now
    await session.commit()
    return InvitationClaimResult(
        access_token=credential,
        device_id=device.id,
        user_id=user.id,
        workspace_id=invitation.workspace_id,
        borrower_profile_id=borrower.id,
        base_url=settings.public_base_url.rstrip("/"),
    )


def checkout_read(checkout: Checkout, item: Item, borrower: BorrowerProfile) -> CheckoutRead:
    now = datetime.now(UTC)
    return CheckoutRead(
        id=checkout.id,
        workspace_id=checkout.workspace_id,
        item_id=item.id,
        item_name=item.name,
        borrower_profile_id=borrower.id,
        borrower_name=borrower.display_name,
        borrower_access_type="self_service" if borrower.linked_user_id else "managed",
        checked_out_at=checkout.checked_out_at,
        due_at=checkout.due_at,
        returned_at=checkout.returned_at,
        checkout_notes=checkout.checkout_notes,
        return_notes=checkout.return_notes,
        checked_out_by_user_id=checkout.checked_out_by_user_id,
        returned_by_user_id=checkout.returned_by_user_id,
        created_at=checkout.created_at,
        updated_at=checkout.updated_at,
        overdue=checkout.returned_at is None
        and checkout.due_at is not None
        and checkout.due_at < now,
    )


@router.get("/workspaces/{workspace_id}/checkouts", response_model=list[CheckoutRead])
async def list_checkouts(
    workspace_id: UUID, principal: PrincipalDep, session: SessionDep, status_filter: str = "active"
):
    membership = await require_workspace_access(workspace_id, principal, session)
    query = (
        select(Checkout, Item, BorrowerProfile)
        .join(Item, Item.id == Checkout.item_id)
        .join(BorrowerProfile, BorrowerProfile.id == Checkout.borrower_profile_id)
        .where(Checkout.workspace_id == workspace_id)
    )
    if membership.role is WorkspaceRole.BORROWER:
        query = query.where(BorrowerProfile.linked_user_id == principal.user.id)
    if status_filter == "active":
        query = query.where(Checkout.returned_at.is_(None))
    elif status_filter == "overdue":
        query = query.where(Checkout.returned_at.is_(None), Checkout.due_at < datetime.now(UTC))
    elif status_filter != "history":
        raise HTTPException(422, "Unknown checkout status")
    rows = (await session.execute(query.order_by(Checkout.checked_out_at.desc()))).all()
    return [checkout_read(*row) for row in rows]


@router.post("/workspaces/{workspace_id}/checkouts", response_model=CheckoutRead, status_code=201)
async def checkout_item(
    workspace_id: UUID, payload: CheckoutCreate, principal: PrincipalDep, session: SessionDep
):
    try:
        checkout = await create_checkout(
            session,
            actor(principal, workspace_id),
            CreateCheckout(
                workspace_id,
                payload.item_id,
                payload.borrower_profile_id,
                payload.due_at,
                payload.notes,
            ),
        )
    except CheckoutNotFound as exc:
        raise HTTPException(404, str(exc)) from exc
    except CheckoutAccessDenied as exc:
        raise HTTPException(403, str(exc)) from exc
    except (CheckoutConflict, IntegrityError) as exc:
        await session.rollback()
        raise HTTPException(409, "Item is already checked out") from exc
    except CheckoutError as exc:
        raise HTTPException(422, str(exc)) from exc
    await realtime_hub.publish(
        workspace_id,
        entity="checkout",
        action="created",
        entity_id=checkout.id,
        source=principal.method,
        event_type="checkout.created",
        details={
            "item_id": str(checkout.item_id),
            "borrower_profile_id": str(checkout.borrower_profile_id),
        },
    )
    return checkout_read(
        checkout,
        await session.get(Item, checkout.item_id),
        await session.get(BorrowerProfile, checkout.borrower_profile_id),
    )


@router.post("/checkouts/{checkout_id}/return", response_model=CheckoutRead)
async def return_item(
    checkout_id: UUID, payload: CheckoutReturn, principal: PrincipalDep, session: SessionDep
):
    try:
        checkout = await return_checkout(session, actor(principal), checkout_id, payload.notes)
    except CheckoutNotFound as exc:
        raise HTTPException(404, str(exc)) from exc
    except CheckoutAccessDenied as exc:
        raise HTTPException(403, str(exc)) from exc
    except CheckoutConflict as exc:
        raise HTTPException(409, str(exc)) from exc
    await realtime_hub.publish(
        checkout.workspace_id,
        entity="checkout",
        action="returned",
        entity_id=checkout.id,
        source=principal.method,
        event_type="checkout.returned",
        details={
            "item_id": str(checkout.item_id),
            "borrower_profile_id": str(checkout.borrower_profile_id),
        },
    )
    return checkout_read(
        checkout,
        await session.get(Item, checkout.item_id),
        await session.get(BorrowerProfile, checkout.borrower_profile_id),
    )
