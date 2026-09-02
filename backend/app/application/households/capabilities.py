from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.context import ActorContext
from app.models import Household, HouseholdRelationship, HouseholdUser


class InvalidHousehold(Exception):
    pass


@dataclass(frozen=True)
class CreateHousehold:
    name: str


async def create_household(
    session: AsyncSession, actor: ActorContext, command: CreateHousehold
) -> Household:
    name = command.name.strip()
    if not name:
        raise InvalidHousehold("Household name is required")
    household = Household(name=name)
    session.add(household)
    try:
        await session.flush()
        session.add(
            HouseholdUser(
                household_id=household.id,
                user_id=actor.user_id,
                relationship_type=HouseholdRelationship.OWNER,
            )
        )
        await session.commit()
        await session.refresh(household)
    except Exception:
        await session.rollback()
        raise
    return household
