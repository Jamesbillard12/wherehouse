import secrets
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.context import ActorContext
from app.models import Area, Container, Item, PhysicalIdentifier, WorkspaceMembership
from app.models.core import IdentifierMedium, IdentifierStatus, IdentifierTargetType


class IdentifierError(Exception):
    """Base error that identifier adapters map to transport-specific responses."""


class IdentifierNotFound(IdentifierError):
    pass


class IdentifierAccessDenied(IdentifierError):
    pass


class InvalidIdentifierTransition(IdentifierError):
    pass


class IdentifierConflict(IdentifierError):
    pass


@dataclass(frozen=True)
class RegisterIdentifier:
    target_type: IdentifierTargetType
    target_id: UUID
    medium: IdentifierMedium


def identifier_payload(public_id: str, version: int = 1) -> str:
    return f"wherehouse://identify/v{version}/{public_id}"


async def _target(session: AsyncSession, target_type: IdentifierTargetType, target_id: UUID):
    target = await session.get(Item if target_type is IdentifierTargetType.ITEM else Container, target_id)
    if target is None or target.is_archived:
        raise IdentifierNotFound(f"{target_type.value.title()} not found")
    if isinstance(target, Item):
        return target, target.workspace_id
    area = await session.get(Area, target.area_id)
    if area is None:
        raise IdentifierNotFound("Container area not found")
    return target, area.workspace_id


async def _require_access(session: AsyncSession, actor: ActorContext, workspace_id: UUID) -> None:
    if actor.workspace_id is not None and actor.workspace_id != workspace_id:
        raise IdentifierAccessDenied("Workspace access denied")
    membership = await session.scalar(select(WorkspaceMembership).where(
        WorkspaceMembership.workspace_id == workspace_id, WorkspaceMembership.user_id == actor.user_id,
    ))
    if membership is None:
        raise IdentifierAccessDenied("Workspace access denied")


async def create_identifier(session: AsyncSession, actor: ActorContext, command: RegisterIdentifier):
    target, workspace_id = await _target(session, command.target_type, command.target_id)
    await _require_access(session, actor, workspace_id)
    existing = await session.scalar(select(PhysicalIdentifier).where(
        PhysicalIdentifier.target_type == command.target_type,
        PhysicalIdentifier.target_id == command.target_id,
        PhysicalIdentifier.medium == command.medium,
        PhysicalIdentifier.status.in_([IdentifierStatus.PENDING, IdentifierStatus.ACTIVE]),
    ))
    if existing is not None:
        return existing, target
    identifier = PhysicalIdentifier(
        workspace_id=workspace_id, public_id=f"idn_{secrets.token_urlsafe(18)}",
        target_type=command.target_type, target_id=command.target_id, medium=command.medium,
        status=IdentifierStatus.ACTIVE if command.medium is IdentifierMedium.QR else IdentifierStatus.PENDING,
    )
    session.add(identifier)
    try:
        await session.commit()
        await session.refresh(identifier)
    except IntegrityError as error:
        await session.rollback()
        existing = await session.scalar(select(PhysicalIdentifier).where(
            PhysicalIdentifier.target_type == command.target_type,
            PhysicalIdentifier.target_id == command.target_id,
            PhysicalIdentifier.medium == command.medium,
            PhysicalIdentifier.status.in_([IdentifierStatus.PENDING, IdentifierStatus.ACTIVE]),
        ))
        if existing is not None:
            return existing, target
        raise IdentifierConflict("An identifier is already registered for this target and medium") from error
    return identifier, target


async def resolve_identifier(session: AsyncSession, actor: ActorContext, public_id: str):
    identifier = await session.scalar(select(PhysicalIdentifier).where(
        PhysicalIdentifier.public_id == public_id,
        PhysicalIdentifier.status == IdentifierStatus.ACTIVE,
    ))
    if identifier is None:
        raise IdentifierNotFound("Identifier not found")
    await _require_access(session, actor, identifier.workspace_id)
    target, target_workspace_id = await _target(session, identifier.target_type, identifier.target_id)
    if target_workspace_id != identifier.workspace_id:
        raise IdentifierNotFound("Identifier target not found")
    return identifier, target


async def activate_identifier(session: AsyncSession, actor: ActorContext, identifier_id: UUID):
    identifier = await session.get(PhysicalIdentifier, identifier_id)
    if identifier is None:
        raise IdentifierNotFound("Identifier not found")
    await _require_access(session, actor, identifier.workspace_id)
    if identifier.status is IdentifierStatus.REVOKED:
        raise InvalidIdentifierTransition("Revoked identifiers cannot be activated")
    if identifier.status is IdentifierStatus.ACTIVE:
        return identifier
    identifier.status = IdentifierStatus.ACTIVE
    await session.commit()
    await session.refresh(identifier)
    return identifier


async def revoke_identifier(session: AsyncSession, actor: ActorContext, identifier_id: UUID):
    identifier = await session.get(PhysicalIdentifier, identifier_id)
    if identifier is None:
        raise IdentifierNotFound("Identifier not found")
    await _require_access(session, actor, identifier.workspace_id)
    if identifier.status is IdentifierStatus.REVOKED:
        return identifier
    identifier.status = IdentifierStatus.REVOKED
    await session.commit()
    await session.refresh(identifier)
    return identifier
