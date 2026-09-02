from uuid import UUID

from fastapi import APIRouter, status
from sqlalchemy import select

from app.api.dependencies import PrincipalDep, SessionDep, require_household_access
from app.application.context import ActorContext
from app.application.households.capabilities import CreateHousehold
from app.application.households.capabilities import create_household as create
from app.models import Household, HouseholdUser, User
from app.repositories.entities import require_entity as require
from app.schemas.core import (
    HouseholdCreate,
    HouseholdRead,
    HouseholdUserCreate,
    HouseholdUserRead,
)

router = APIRouter()

@router.post("/households", response_model=HouseholdRead, status_code=status.HTTP_201_CREATED)
async def create_household(
    payload: HouseholdCreate, principal: PrincipalDep, session: SessionDep
) -> Household:
    return await create(
        session,
        ActorContext(
            user_id=principal.user.id,
            client=principal.method,
            device_id=principal.device_id,
            household_id=principal.device_household_id,
        ),
        CreateHousehold(payload.name),
    )


@router.get("/households", response_model=list[HouseholdRead])
async def list_households(principal: PrincipalDep, session: SessionDep) -> list[Household]:
    query = (
        select(Household)
        .join(HouseholdUser)
        .where(HouseholdUser.user_id == principal.user.id)
        .order_by(Household.name)
    )
    result = await session.scalars(query)
    return list(result)


@router.post(
    "/households/{household_id}/users",
    response_model=HouseholdUserRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_household_user(
    household_id: UUID,
    payload: HouseholdUserCreate,
    principal: PrincipalDep,
    session: SessionDep,
) -> HouseholdUser:
    await require_household_access(household_id, principal, session, owner=True)
    await require(session, User, payload.user_id, "User")
    membership = HouseholdUser(
        household_id=household_id,
        user_id=payload.user_id,
        relationship_type=payload.relationship_type,
    )
    session.add(membership)
    await session.commit()
    await session.refresh(membership)
    return membership
