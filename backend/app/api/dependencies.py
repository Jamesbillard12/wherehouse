from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import token_hash
from app.db.session import get_db_session
from app.models import Device, HouseholdRelationship, HouseholdUser, User, UserSession

SessionDep = Annotated[AsyncSession, Depends(get_db_session)]
bearer = HTTPBearer(auto_error=False)
BearerDep = Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]


@dataclass(frozen=True)
class Principal:
    user: User
    method: str
    device_id: UUID | None = None
    device_household_id: UUID | None = None


async def get_current_principal(credentials: BearerDep, session: SessionDep) -> Principal:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required"
        )

    digest = token_hash(credentials.credentials)
    now = datetime.now(UTC)
    user_session = await session.scalar(
        select(UserSession).where(
            UserSession.token_hash == digest,
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > now,
        )
    )
    if user_session is not None:
        user = await session.get(User, user_session.user_id)
        if user is not None:
            return Principal(user=user, method="user_session")

    device = await session.scalar(
        select(Device).where(
            Device.credential_hash == digest,
            Device.is_active.is_(True),
            Device.revoked_at.is_(None),
        )
    )
    if device is not None:
        user = await session.get(User, device.user_id)
        if user is not None:
            if device.last_seen_at is None or device.last_seen_at < now - timedelta(minutes=5):
                device.last_seen_at = now
                await session.commit()
            return Principal(
                user=user,
                method="device",
                device_id=device.id,
                device_household_id=device.household_id,
            )

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")


PrincipalDep = Annotated[Principal, Depends(get_current_principal)]


async def require_household_access(
    household_id: UUID,
    principal: Principal,
    session: AsyncSession,
    *,
    owner: bool = False,
) -> HouseholdUser:
    if principal.device_household_id is not None and principal.device_household_id != household_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Household access denied")
    membership = await session.scalar(
        select(HouseholdUser).where(
            HouseholdUser.household_id == household_id,
            HouseholdUser.user_id == principal.user.id,
        )
    )
    if membership is None or (
        owner and membership.relationship_type is not HouseholdRelationship.OWNER
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Household access denied")
    return membership
