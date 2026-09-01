from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.dependencies import (
    BearerDep,
    PrincipalDep,
    SessionDep,
    require_household_access,
)
from app.core.config import get_settings
from app.core.security import hash_password, new_token, token_hash, verify_password
from app.models import (
    AppInstance,
    Device,
    HouseholdUser,
    PairingSession,
    User,
    UserSession,
)
from app.schemas.auth import (
    AccessToken,
    AuthUser,
    DeviceRead,
    HouseholdAccess,
    LoginRequest,
    MeResponse,
    PairingConsume,
    PairingResult,
    PairingSessionCreate,
    PairingSessionCreated,
    RegisterRequest,
)

router = APIRouter()
settings = get_settings()


async def issue_user_session(user: User, session: SessionDep) -> AccessToken:
    raw_token = new_token("usr")
    expires_at = datetime.now(UTC) + timedelta(hours=settings.user_session_ttl_hours)
    session.add(
        UserSession(user_id=user.id, token_hash=token_hash(raw_token), expires_at=expires_at)
    )
    await session.commit()
    return AccessToken(access_token=raw_token, expires_at=expires_at)


@router.post("/auth/register", response_model=AccessToken, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, session: SessionDep) -> AccessToken:
    user = User(
        email=payload.email.strip().lower(),
        display_name=payload.display_name.strip(),
        password_hash=hash_password(payload.password),
    )
    session.add(user)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status_code=409, detail="Email is already registered") from exc
    return await issue_user_session(user, session)


@router.post("/auth/login", response_model=AccessToken)
async def login(payload: LoginRequest, session: SessionDep) -> AccessToken:
    user = await session.scalar(select(User).where(User.email == payload.email.strip().lower()))
    if (
        user is None
        or user.password_hash is None
        or not verify_password(payload.password, user.password_hash)
    ):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return await issue_user_session(user, session)


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(credentials: BearerDep, principal: PrincipalDep, session: SessionDep) -> None:
    if principal.method == "user_session" and credentials is not None:
        user_session = await session.scalar(
            select(UserSession).where(UserSession.token_hash == token_hash(credentials.credentials))
        )
        if user_session is not None:
            user_session.revoked_at = datetime.now(UTC)
            await session.commit()


@router.get("/auth/me", response_model=MeResponse)
async def me(principal: PrincipalDep, session: SessionDep) -> MeResponse:
    query = select(HouseholdUser).where(HouseholdUser.user_id == principal.user.id)
    memberships = list(await session.scalars(query))
    return MeResponse(
        user=AuthUser.model_validate(principal.user, from_attributes=True),
        authenticated_by=principal.method,
        device_id=principal.device_id,
        households=[
            HouseholdAccess(
                household_id=membership.household_id,
                relationship_type=membership.relationship_type,
            )
            for membership in memberships
        ],
    )


@router.post(
    "/households/{household_id}/pairing-sessions",
    response_model=PairingSessionCreated,
    status_code=status.HTTP_201_CREATED,
)
async def create_pairing_session(
    household_id: UUID,
    payload: PairingSessionCreate,
    principal: PrincipalDep,
    session: SessionDep,
) -> PairingSessionCreated:
    await require_household_access(household_id, principal, session, owner=True)
    instance = await session.scalar(
        select(AppInstance).where(AppInstance.household_id == household_id)
    )
    if instance is None:
        instance = AppInstance(
            household_id=household_id,
            name=payload.instance_name,
            base_url=settings.public_base_url.rstrip("/"),
            instance_type=payload.instance_type,
        )
        session.add(instance)
    else:
        instance.name = payload.instance_name
        instance.base_url = settings.public_base_url.rstrip("/")
        instance.instance_type = payload.instance_type

    raw_token = new_token("pair")
    expires_at = datetime.now(UTC) + timedelta(minutes=settings.pairing_session_ttl_minutes)
    pairing = PairingSession(
        household_id=household_id,
        created_by_user_id=principal.user.id,
        token_hash=token_hash(raw_token),
        expires_at=expires_at,
    )
    session.add(pairing)
    await session.commit()
    pairing_uri = "wherehouse://pair?" + urlencode(
        {"server": instance.base_url, "token": raw_token}
    )
    return PairingSessionCreated(
        id=pairing.id, token=raw_token, pairing_uri=pairing_uri, expires_at=expires_at
    )


@router.post("/pairing/consume", response_model=PairingResult)
async def consume_pairing(payload: PairingConsume, session: SessionDep) -> PairingResult:
    now = datetime.now(UTC)
    pairing = await session.scalar(
        select(PairingSession)
        .where(PairingSession.token_hash == token_hash(payload.token))
        .with_for_update()
    )
    if pairing is None or pairing.consumed_at is not None or pairing.expires_at <= now:
        raise HTTPException(status_code=400, detail="Pairing token is invalid or expired")

    instance = await session.scalar(
        select(AppInstance).where(AppInstance.household_id == pairing.household_id)
    )
    if instance is None:
        raise HTTPException(status_code=409, detail="Application instance is not configured")

    credential = new_token("dev")
    device = Device(
        household_id=pairing.household_id,
        user_id=pairing.created_by_user_id,
        name=payload.device_name.strip(),
        device_type=payload.device_type,
        credential_hash=token_hash(credential),
        last_seen_at=now,
    )
    session.add(device)
    await session.flush()
    pairing.consumed_at = now
    pairing.consumed_by_device_id = device.id
    await session.commit()
    return PairingResult(
        access_token=credential,
        device_id=device.id,
        user_id=device.user_id,
        household_id=device.household_id,
        instance_id=instance.id,
        instance_name=instance.name,
        base_url=instance.base_url,
    )


@router.get("/households/{household_id}/devices", response_model=list[DeviceRead])
async def list_devices(
    household_id: UUID, principal: PrincipalDep, session: SessionDep
) -> list[Device]:
    await require_household_access(household_id, principal, session, owner=True)
    return list(
        await session.scalars(
            select(Device).where(Device.household_id == household_id).order_by(Device.name)
        )
    )


@router.delete("/devices/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_device(device_id: UUID, principal: PrincipalDep, session: SessionDep) -> None:
    device = await session.get(Device, device_id)
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")
    await require_household_access(device.household_id, principal, session, owner=True)
    device.is_active = False
    device.revoked_at = datetime.now(UTC)
    await session.commit()
