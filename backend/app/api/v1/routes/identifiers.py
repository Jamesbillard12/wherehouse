from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.dependencies import PrincipalDep, SessionDep, require_household_access
from app.application.identifiers.capabilities import (
    create_identifier,
    identifier_payload,
    resolve_identifier,
)
from app.models import Container, Item, PhysicalIdentifier
from app.models.core import IdentifierStatus
from app.schemas.core import IdentifierCreate, IdentifierRead, IdentifierResolution
from app.services.realtime import realtime_hub

router = APIRouter()


def identifier_read(identifier: PhysicalIdentifier) -> dict:
    return {
        "id": identifier.id, "household_id": identifier.household_id,
        "public_id": identifier.public_id, "target_type": identifier.target_type,
        "target_id": identifier.target_id, "medium": identifier.medium,
        "status": identifier.status, "payload_version": identifier.payload_version,
        "payload": identifier_payload(identifier.public_id, identifier.payload_version),
        "created_at": identifier.created_at, "updated_at": identifier.updated_at,
    }


@router.post("/identifiers", response_model=IdentifierRead, status_code=status.HTTP_201_CREATED)
async def assign_identifier(payload: IdentifierCreate, principal: PrincipalDep, session: SessionDep):
    model = Item if payload.target_type.value == "item" else Container
    target = await session.get(model, payload.target_id)
    if target is None:
        raise HTTPException(status_code=404, detail=f"{payload.target_type.value.title()} not found")
    if isinstance(target, Item):
        household_id = target.household_id
    else:
        from app.models import Area
        area = await session.get(Area, target.area_id)
        household_id = area.household_id
    await require_household_access(household_id, principal, session)
    identifier, _ = await create_identifier(session, payload.target_type, payload.target_id, payload.medium)
    return identifier_read(identifier)


@router.get("/identifiers/{public_id}/resolve", response_model=IdentifierResolution)
async def resolve(public_id: str, principal: PrincipalDep, session: SessionDep):
    identifier, target = await resolve_identifier(session, public_id)
    await require_household_access(identifier.household_id, principal, session)
    await realtime_hub.publish(
        identifier.household_id,
        entity=identifier.target_type.value,
        action="resolved",
        entity_id=identifier.target_id,
        source=principal.method,
        event_type="identifier.resolved",
        details={"area_id": str(target.area_id)} if isinstance(target, Container) else None,
    )
    return {"identifier": identifier_read(identifier), "item": target if isinstance(target, Item) else None, "container": target if isinstance(target, Container) else None}


@router.get("/{target_type}/{target_id}/identifiers", response_model=list[IdentifierRead])
async def list_identifiers(target_type: str, target_id: UUID, principal: PrincipalDep, session: SessionDep):
    if target_type not in {"items", "containers"}:
        raise HTTPException(status_code=404, detail="Identifier target not found")
    kind = "item" if target_type == "items" else "container"
    identifiers = list(await session.scalars(select(PhysicalIdentifier).where(
        PhysicalIdentifier.target_type == kind, PhysicalIdentifier.target_id == target_id,
        PhysicalIdentifier.status == IdentifierStatus.ACTIVE,
    ).order_by(PhysicalIdentifier.created_at)))
    if not identifiers:
        model = Item if kind == "item" else Container
        target = await session.get(model, target_id)
        if target is None:
            raise HTTPException(status_code=404, detail=f"{kind.title()} not found")
        if isinstance(target, Item):
            household_id = target.household_id
        else:
            from app.models import Area
            area = await session.get(Area, target.area_id)
            household_id = area.household_id
    else:
        household_id = identifiers[0].household_id
    await require_household_access(household_id, principal, session)
    return [identifier_read(value) for value in identifiers]


@router.delete("/identifiers/{identifier_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke(identifier_id: UUID, principal: PrincipalDep, session: SessionDep) -> None:
    identifier = await session.get(PhysicalIdentifier, identifier_id)
    if identifier is None:
        raise HTTPException(status_code=404, detail="Identifier not found")
    await require_household_access(identifier.household_id, principal, session)
    identifier.status = IdentifierStatus.REVOKED
    await session.commit()


@router.post("/identifiers/{identifier_id}/activate", response_model=IdentifierRead)
async def activate(identifier_id: UUID, principal: PrincipalDep, session: SessionDep):
    identifier = await session.get(PhysicalIdentifier, identifier_id)
    if identifier is None:
        raise HTTPException(status_code=404, detail="Identifier not found")
    await require_household_access(identifier.household_id, principal, session)
    if identifier.status is IdentifierStatus.REVOKED:
        raise HTTPException(status_code=409, detail="Revoked identifiers cannot be activated")
    identifier.status = IdentifierStatus.ACTIVE
    await session.commit()
    await session.refresh(identifier)
    return identifier_read(identifier)
