import secrets
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Area, Container, Item, PhysicalIdentifier
from app.models.core import IdentifierMedium, IdentifierStatus, IdentifierTargetType


def identifier_payload(public_id: str, version: int = 1) -> str:
    return f"wherehouse://identify/v{version}/{public_id}"


async def _target(session: AsyncSession, target_type: IdentifierTargetType, target_id: UUID):
    target = await session.get(Item if target_type is IdentifierTargetType.ITEM else Container, target_id)
    if target is None:
        raise HTTPException(status_code=404, detail=f"{target_type.value.title()} not found")
    if isinstance(target, Item):
        return target, target.household_id
    area = await session.get(Area, target.area_id)
    if area is None:
        raise HTTPException(status_code=404, detail="Container area not found")
    return target, area.household_id


async def create_identifier(session: AsyncSession, target_type: IdentifierTargetType, target_id: UUID, medium: IdentifierMedium):
    target, household_id = await _target(session, target_type, target_id)
    existing = await session.scalar(select(PhysicalIdentifier).where(
        PhysicalIdentifier.target_type == target_type,
        PhysicalIdentifier.target_id == target_id,
        PhysicalIdentifier.medium == medium,
        PhysicalIdentifier.status.in_([IdentifierStatus.PENDING, IdentifierStatus.ACTIVE]),
    ))
    if existing is not None:
        return existing, target
    identifier = PhysicalIdentifier(
        household_id=household_id, public_id=f"idn_{secrets.token_urlsafe(18)}",
        target_type=target_type, target_id=target_id, medium=medium,
        status=IdentifierStatus.ACTIVE if medium is IdentifierMedium.QR else IdentifierStatus.PENDING,
    )
    session.add(identifier)
    await session.commit()
    await session.refresh(identifier)
    return identifier, target


async def resolve_identifier(session: AsyncSession, public_id: str):
    identifier = await session.scalar(select(PhysicalIdentifier).where(
        PhysicalIdentifier.public_id == public_id,
        PhysicalIdentifier.status == IdentifierStatus.ACTIVE,
    ))
    if identifier is None:
        raise HTTPException(status_code=404, detail="Identifier not found")
    target, _ = await _target(session, identifier.target_type, identifier.target_id)
    return identifier, target
