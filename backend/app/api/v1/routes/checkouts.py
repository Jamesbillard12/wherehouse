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
    CheckoutItemsConflict,
    CheckoutNotFound,
    CheckoutRevisionConflict,
    CreateCheckout,
    abandon_session,
    add_session_item,
    create_checkout,
    finalize_session,
    get_or_create_active_session,
    remove_session_item,
    return_checkout,
    update_active_session,
)
from app.application.context import ActorContext
from app.core.config import get_settings
from app.core.security import hash_password, new_token, token_hash, verify_password
from app.models import (
    BorrowerInvitation,
    BorrowerProfile,
    Checkout,
    CheckoutSession,
    CheckoutSessionItem,
    CheckoutSessionStatus,
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
    CheckoutSessionFinalize,
    CheckoutSessionItemAdd,
    CheckoutSessionItemRead,
    CheckoutSessionRead,
    CheckoutSessionUpdate,
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


async def checkout_session_read(
    current: CheckoutSession, principal: PrincipalDep, session: SessionDep
) -> CheckoutSessionRead:
    viewer_membership = await session.scalar(
        select(WorkspaceMembership).where(
            WorkspaceMembership.workspace_id == current.workspace_id,
            WorkspaceMembership.user_id == principal.user.id,
        )
    )
    actor_user = await session.get(User, current.actor_user_id)
    borrower = (
        await session.get(BorrowerProfile, current.borrower_profile_id)
        if current.borrower_profile_id
        else None
    )
    rows = (
        await session.execute(
            select(CheckoutSessionItem, Item)
            .join(Item, Item.id == CheckoutSessionItem.item_id)
            .where(CheckoutSessionItem.checkout_session_id == current.id)
            .order_by(CheckoutSessionItem.added_at)
        )
    ).all()
    active_checkout_ids = (
        set(
            await session.scalars(
                select(Checkout.item_id).where(
                    Checkout.item_id.in_([item.id for _, item in rows]),
                    Checkout.returned_at.is_(None),
                )
            )
        )
        if rows
        else set()
    )
    result_items = []
    for entry, item in rows:
        other_names = list(
            await session.scalars(
                select(User.display_name)
                .join(CheckoutSession, CheckoutSession.actor_user_id == User.id)
                .join(
                    CheckoutSessionItem,
                    CheckoutSessionItem.checkout_session_id == CheckoutSession.id,
                )
                .where(
                    CheckoutSession.workspace_id == current.workspace_id,
                    CheckoutSession.status == CheckoutSessionStatus.ACTIVE,
                    CheckoutSession.id != current.id,
                    CheckoutSessionItem.item_id == item.id,
                )
            )
        )
        if viewer_membership is not None and viewer_membership.role is WorkspaceRole.BORROWER:
            other_names = ["another person"] if other_names else []
        result_items.append(
            CheckoutSessionItemRead(
                id=entry.id,
                item_id=item.id,
                item_name=item.name,
                item_code=item.code,
                image_path=item.image_path,
                manufacturer=item.manufacturer,
                model=item.model,
                availability="checked_out"
                if item.id in active_checkout_ids
                else "in_another_session"
                if other_names
                else "available",
                also_in_sessions=other_names,
                added_at=entry.added_at,
            )
        )
    return CheckoutSessionRead(
        id=current.id,
        workspace_id=current.workspace_id,
        actor_user_id=current.actor_user_id,
        actor_name=actor_user.display_name if actor_user else "Unknown user",
        borrower_profile_id=current.borrower_profile_id,
        borrower_name=borrower.display_name if borrower else None,
        due_at=current.due_at,
        note=current.note,
        status=current.status.value,
        revision=current.revision,
        editable=current.actor_user_id == principal.user.id,
        items=result_items,
        created_at=current.created_at,
        updated_at=current.updated_at,
    )


async def publish_session(current: CheckoutSession, principal: PrincipalDep, action: str) -> None:
    await realtime_hub.publish_checkout_session(
        current.workspace_id,
        actor_user_id=current.actor_user_id,
        event={
            "type": f"checkout_session.{action}",
            "entity": "checkout-session",
            "action": action,
            "entity_id": str(current.id),
            "source": principal.method,
            "actor_user_id": str(current.actor_user_id),
            "revision": str(current.revision),
        },
    )


async def publish_item_awareness(
    workspace_id: UUID, item_ids: list[UUID], session: SessionDep, *, action: str
) -> None:
    if not item_ids:
        return
    affected = (
        await session.execute(
            select(CheckoutSession.id, CheckoutSession.actor_user_id)
            .join(
                CheckoutSessionItem,
                CheckoutSessionItem.checkout_session_id == CheckoutSession.id,
            )
            .where(
                CheckoutSession.workspace_id == workspace_id,
                CheckoutSession.status == CheckoutSessionStatus.ACTIVE,
                CheckoutSessionItem.item_id.in_(item_ids),
            )
            .distinct()
        )
    ).all()
    for affected_session_id, affected_actor_id in affected:
        await realtime_hub.publish_checkout_session(
            workspace_id,
            actor_user_id=affected_actor_id,
            event={
                "type": f"checkout_session.{action}",
                "entity": "checkout-session",
                "action": action,
                "entity_id": str(affected_session_id),
                "source": "server",
            },
        )


@router.post(
    "/workspaces/{workspace_id}/checkout-sessions/current", response_model=CheckoutSessionRead
)
async def current_checkout_session(
    workspace_id: UUID, principal: PrincipalDep, session: SessionDep
):
    current = await get_or_create_active_session(
        session, actor(principal, workspace_id), workspace_id
    )
    return await checkout_session_read(current, principal, session)


@router.get(
    "/workspaces/{workspace_id}/checkout-sessions", response_model=list[CheckoutSessionRead]
)
async def list_checkout_sessions(workspace_id: UUID, principal: PrincipalDep, session: SessionDep):
    membership = await require_workspace_access(workspace_id, principal, session)
    query = select(CheckoutSession).where(
        CheckoutSession.workspace_id == workspace_id,
        CheckoutSession.status == CheckoutSessionStatus.ACTIVE,
    )
    if membership.role is WorkspaceRole.BORROWER:
        query = query.where(CheckoutSession.actor_user_id == principal.user.id)
    currents = list(await session.scalars(query.order_by(CheckoutSession.updated_at.desc())))
    return [await checkout_session_read(current, principal, session) for current in currents]


@router.patch("/checkout-sessions/{session_id}", response_model=CheckoutSessionRead)
async def edit_checkout_session(
    session_id: UUID, payload: CheckoutSessionUpdate, principal: PrincipalDep, session: SessionDep
):
    try:
        current = await update_active_session(
            session,
            actor(principal),
            session_id,
            borrower_profile_id=payload.borrower_profile_id,
            due_at=payload.due_at,
            note=payload.note,
            expected_revision=payload.expected_revision,
        )
    except CheckoutRevisionConflict as exc:
        raise HTTPException(409, str(exc)) from exc
    except CheckoutAccessDenied as exc:
        raise HTTPException(403, str(exc)) from exc
    except CheckoutNotFound as exc:
        raise HTTPException(404, str(exc)) from exc
    await publish_session(current, principal, "updated")
    return await checkout_session_read(current, principal, session)


@router.post("/checkout-sessions/{session_id}/items", response_model=CheckoutSessionRead)
async def add_checkout_session_item(
    session_id: UUID, payload: CheckoutSessionItemAdd, principal: PrincipalDep, session: SessionDep
):
    try:
        current = await add_session_item(session, actor(principal), session_id, payload.item_id)
    except CheckoutAccessDenied as exc:
        raise HTTPException(403, str(exc)) from exc
    except CheckoutNotFound as exc:
        raise HTTPException(404, str(exc)) from exc
    except CheckoutConflict as exc:
        raise HTTPException(409, str(exc)) from exc
    await publish_session(current, principal, "item_added")
    await publish_item_awareness(current.workspace_id, [payload.item_id], session, action="updated")
    return await checkout_session_read(current, principal, session)


@router.delete(
    "/checkout-sessions/{session_id}/items/{item_id}", response_model=CheckoutSessionRead
)
async def delete_checkout_session_item(
    session_id: UUID, item_id: UUID, principal: PrincipalDep, session: SessionDep
):
    try:
        current = await remove_session_item(session, actor(principal), session_id, item_id)
    except CheckoutAccessDenied as exc:
        raise HTTPException(403, str(exc)) from exc
    except CheckoutNotFound as exc:
        raise HTTPException(404, str(exc)) from exc
    await publish_session(current, principal, "item_removed")
    await publish_item_awareness(current.workspace_id, [item_id], session, action="updated")
    return await checkout_session_read(current, principal, session)


@router.post("/checkout-sessions/{session_id}/complete", response_model=list[CheckoutRead])
async def complete_checkout_session(
    session_id: UUID, payload: CheckoutSessionFinalize, principal: PrincipalDep, session: SessionDep
):
    try:
        current, checkouts = await finalize_session(
            session, actor(principal), session_id, payload.expected_revision
        )
    except CheckoutItemsConflict as exc:
        raise HTTPException(
            409,
            {"message": str(exc), "conflicting_item_ids": [str(value) for value in exc.item_ids]},
        ) from exc
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(409, "One or more items were checked out concurrently") from exc
    except CheckoutRevisionConflict as exc:
        raise HTTPException(409, str(exc)) from exc
    except CheckoutAccessDenied as exc:
        raise HTTPException(403, str(exc)) from exc
    except CheckoutNotFound as exc:
        raise HTTPException(404, str(exc)) from exc
    except CheckoutError as exc:
        raise HTTPException(422, str(exc)) from exc
    await publish_session(current, principal, "completed")
    await publish_item_awareness(
        current.workspace_id,
        [checkout.item_id for checkout in checkouts],
        session,
        action="item_conflicted",
    )
    result = []
    for checkout in checkouts:
        result.append(
            checkout_read(
                checkout,
                await session.get(Item, checkout.item_id),
                await session.get(BorrowerProfile, checkout.borrower_profile_id),
            )
        )
    return result


@router.delete("/checkout-sessions/{session_id}", response_model=CheckoutSessionRead)
async def abandon_checkout_session(session_id: UUID, principal: PrincipalDep, session: SessionDep):
    try:
        current = await abandon_session(session, actor(principal), session_id)
    except CheckoutAccessDenied as exc:
        raise HTTPException(403, str(exc)) from exc
    except CheckoutNotFound as exc:
        raise HTTPException(404, str(exc)) from exc
    await publish_session(current, principal, "abandoned")
    return await checkout_session_read(current, principal, session)


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
