from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import Response
from sqlalchemy import select

from app.api.dependencies import PrincipalDep, SessionDep, require_household_access
from app.models import Area, Container, ContainerPlacement, Zone
from app.repositories.entities import require_entity as require
from app.schemas.core import (
    AreaCreate,
    AreaRead,
    AreaUpdate,
    ContainerCreate,
    ContainerPlacementCreate,
    ContainerPlacementRead,
    ContainerRead,
    ContainerUpdate,
    ZoneCreate,
    ZoneRead,
    ZoneUpdate,
)
from app.services.container_codes import next_container_code
from app.services.image_storage import get_image_storage
from app.services.realtime import realtime_hub

router = APIRouter()

CONTAINER_IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_CONTAINER_IMAGE_BYTES = 8 * 1024 * 1024

@router.post(
    "/households/{household_id}/areas",
    response_model=AreaRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_area(
    household_id: UUID,
    payload: AreaCreate,
    principal: PrincipalDep,
    session: SessionDep,
) -> Area:
    await require_household_access(household_id, principal, session)
    area = Area(household_id=household_id, **payload.model_dump())
    session.add(area)
    await session.commit()
    await session.refresh(area)
    await realtime_hub.publish(household_id, entity="area", action="created", entity_id=area.id, source=principal.method)
    return area


@router.get("/households/{household_id}/areas", response_model=list[AreaRead])
async def list_areas(
    household_id: UUID, principal: PrincipalDep, session: SessionDep
) -> list[Area]:
    await require_household_access(household_id, principal, session)
    result = await session.scalars(
        select(Area).where(Area.household_id == household_id).order_by(Area.name)
    )
    return list(result)


@router.patch("/areas/{area_id}", response_model=AreaRead)
async def update_area(
    area_id: UUID, payload: AreaUpdate, principal: PrincipalDep, session: SessionDep
) -> Area:
    area = await require(session, Area, area_id, "Area")
    await require_household_access(area.household_id, principal, session)
    area.icon = payload.icon
    await session.commit()
    await session.refresh(area)
    await realtime_hub.publish(area.household_id, entity="area", action="updated", entity_id=area.id, source=principal.method)
    return area


@router.delete("/areas/{area_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_area(area_id: UUID, principal: PrincipalDep, session: SessionDep) -> None:
    area = await require(session, Area, area_id, "Area")
    await require_household_access(area.household_id, principal, session)
    household_id = area.household_id
    await session.delete(area)
    await session.commit()
    await realtime_hub.publish(household_id, entity="area", action="deleted", entity_id=area_id, source=principal.method)


@router.post("/areas/{area_id}/zones", response_model=ZoneRead, status_code=status.HTTP_201_CREATED)
async def create_zone(
    area_id: UUID, payload: ZoneCreate, principal: PrincipalDep, session: SessionDep
) -> Zone:
    area = await require(session, Area, area_id, "Area")
    await require_household_access(area.household_id, principal, session)
    zone = Zone(area_id=area_id, **payload.model_dump())
    session.add(zone)
    await session.commit()
    await session.refresh(zone)
    await realtime_hub.publish(area.household_id, entity="zone", action="created", entity_id=zone.id, source=principal.method)
    return zone


@router.get("/areas/{area_id}/zones", response_model=list[ZoneRead])
async def list_zones(area_id: UUID, principal: PrincipalDep, session: SessionDep) -> list[Zone]:
    area = await require(session, Area, area_id, "Area")
    await require_household_access(area.household_id, principal, session)
    result = await session.scalars(select(Zone).where(Zone.area_id == area_id).order_by(Zone.name))
    return list(result)


@router.patch("/zones/{zone_id}", response_model=ZoneRead)
async def update_zone(
    zone_id: UUID, payload: ZoneUpdate, principal: PrincipalDep, session: SessionDep
) -> Zone:
    zone = await require(session, Zone, zone_id, "Zone")
    area = await require(session, Area, zone.area_id, "Area")
    await require_household_access(area.household_id, principal, session)
    zone.name = payload.name
    zone.description = payload.description
    await session.commit()
    await session.refresh(zone)
    await realtime_hub.publish(area.household_id, entity="zone", action="updated", entity_id=zone.id, source=principal.method)
    return zone


@router.post("/containers", response_model=ContainerRead, status_code=status.HTTP_201_CREATED)
async def create_container(
    payload: ContainerCreate, principal: PrincipalDep, session: SessionDep
) -> Container:
    area = await require(session, Area, payload.area_id, "Area")
    await require_household_access(area.household_id, principal, session)
    if payload.zone_id is not None:
        zone = await require(session, Zone, payload.zone_id, "Zone")
        if zone.area_id != area.id:
            raise HTTPException(status_code=400, detail="Zone must belong to the selected area")
    code = await next_container_code(session, payload.container_type.value)
    container = Container(code=code, **payload.model_dump())
    session.add(container)
    await session.commit()
    await session.refresh(container)
    await realtime_hub.publish(area.household_id, entity="container", action="created", entity_id=container.id, source=principal.method)
    return container


@router.patch("/containers/{container_id}", response_model=ContainerRead)
async def update_container(
    container_id: UUID,
    payload: ContainerUpdate,
    principal: PrincipalDep,
    session: SessionDep,
) -> Container:
    container = await require(session, Container, container_id, "Container")
    area = await require(session, Area, container.area_id, "Area")
    await require_household_access(area.household_id, principal, session)
    if payload.zone_id is not None:
        zone = await require(session, Zone, payload.zone_id, "Zone")
        if zone.area_id != area.id:
            raise HTTPException(status_code=400, detail="Zone must belong to the selected area")
    for field, value in payload.model_dump().items():
        setattr(container, field, value)
    await session.commit()
    await session.refresh(container)
    await realtime_hub.publish(area.household_id, entity="container", action="updated", entity_id=container.id, source=principal.method)
    return container


@router.put("/containers/{container_id}/image", response_model=ContainerRead)
async def upload_container_image(
    container_id: UUID, request: Request, principal: PrincipalDep, session: SessionDep
) -> Container:
    container = await require(session, Container, container_id, "Container")
    area = await require(session, Area, container.area_id, "Area")
    await require_household_access(area.household_id, principal, session)
    content_type = request.headers.get("content-type", "").split(";", 1)[0].lower()
    extension = CONTAINER_IMAGE_TYPES.get(content_type)
    if extension is None:
        raise HTTPException(status_code=415, detail="Container images must be JPEG, PNG, or WebP.")
    body = await request.body()
    if not body or len(body) > MAX_CONTAINER_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Container images must be between 1 byte and 8 MB.")
    storage = get_image_storage()
    previous_key = container.image_path
    object_key = f"households/{area.household_id}/containers/{container.id}{extension}"
    storage.put(object_key, body, content_type)
    container.image_path = object_key
    await session.commit()
    await session.refresh(container)
    await realtime_hub.publish(area.household_id, entity="container", action="image.updated", entity_id=container.id, source=principal.method)
    if previous_key and previous_key != object_key:
        storage.delete(previous_key)
    return container


@router.get("/containers/{container_id}/image")
async def get_container_image(
    container_id: UUID, principal: PrincipalDep, session: SessionDep
) -> Response:
    container = await require(session, Container, container_id, "Container")
    area = await require(session, Area, container.area_id, "Area")
    await require_household_access(area.household_id, principal, session)
    if not container.image_path:
        raise HTTPException(status_code=404, detail="Container image not found")
    stored = get_image_storage().get(container.image_path)
    if stored is None:
        raise HTTPException(status_code=404, detail="Container image not found")
    return Response(content=stored.content, media_type=stored.content_type, headers={"Cache-Control": "private, no-store"})


@router.delete("/containers/{container_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_container(
    container_id: UUID, principal: PrincipalDep, session: SessionDep
) -> None:
    container = await require(session, Container, container_id, "Container")
    area = await require(session, Area, container.area_id, "Area")
    await require_household_access(area.household_id, principal, session)
    household_id = area.household_id
    await session.delete(container)
    await session.commit()
    await realtime_hub.publish(household_id, entity="container", action="deleted", entity_id=container_id, source=principal.method)


@router.get("/areas/{area_id}/containers", response_model=list[ContainerRead])
async def list_containers(
    area_id: UUID, principal: PrincipalDep, session: SessionDep
) -> list[Container]:
    area = await require(session, Area, area_id, "Area")
    await require_household_access(area.household_id, principal, session)
    result = await session.scalars(
        select(Container)
        .where(Container.area_id == area_id, Container.is_archived.is_(False))
        .order_by(Container.name)
    )
    return list(result)


@router.get("/containers/by-code/{code}", response_model=ContainerRead)
async def get_container_by_code(
    code: str, principal: PrincipalDep, session: SessionDep
) -> Container:
    container = await session.scalar(
        select(Container).where(
            Container.code == code.strip().upper(), Container.is_archived.is_(False)
        )
    )
    if container is None:
        raise HTTPException(status_code=404, detail="Container not found")
    area = await require(session, Area, container.area_id, "Area")
    await require_household_access(area.household_id, principal, session)
    return container


@router.get(
    "/areas/{area_id}/container-placements",
    response_model=list[ContainerPlacementRead],
)
async def list_container_placements(
    area_id: UUID, principal: PrincipalDep, session: SessionDep
) -> list[ContainerPlacement]:
    area = await require(session, Area, area_id, "Area")
    await require_household_access(area.household_id, principal, session)
    result = await session.scalars(
        select(ContainerPlacement)
        .join(Container, Container.id == ContainerPlacement.container_id)
        .where(Container.area_id == area_id)
        .order_by(ContainerPlacement.position, ContainerPlacement.created_at)
    )
    return list(result)


@router.put("/containers/{container_id}/placement", response_model=ContainerPlacementRead)
async def place_container(
    container_id: UUID,
    payload: ContainerPlacementCreate,
    principal: PrincipalDep,
    session: SessionDep,
) -> ContainerPlacement:
    container = await require(session, Container, container_id, "Container")
    area = await require(session, Area, container.area_id, "Area")
    await require_household_access(area.household_id, principal, session)
    parent = await require(session, Container, payload.parent_container_id, "Parent container")
    if container.area_id != parent.area_id:
        raise HTTPException(
            status_code=400, detail="Nested containers must belong to the same area"
        )
    ancestor_id = parent.id
    visited: set[UUID] = set()
    while ancestor_id not in visited:
        if ancestor_id == container.id:
            raise HTTPException(status_code=400, detail="Container placement would create a cycle")
        visited.add(ancestor_id)
        ancestor_id = await session.scalar(
            select(ContainerPlacement.parent_container_id).where(
                ContainerPlacement.container_id == ancestor_id
            )
        )
        if ancestor_id is None:
            break
    placement = await session.scalar(
        select(ContainerPlacement).where(ContainerPlacement.container_id == container_id)
    )
    if placement is None:
        placement = ContainerPlacement(container_id=container_id, **payload.model_dump())
        session.add(placement)
    else:
        placement.parent_container_id = payload.parent_container_id
        placement.relationship_type = payload.relationship_type
        placement.position = payload.position
    await session.commit()
    await session.refresh(placement)
    await realtime_hub.publish(area.household_id, entity="container-placement", action="updated", entity_id=placement.id, source=principal.method)
    return placement


@router.delete("/containers/{container_id}/placement", status_code=status.HTTP_204_NO_CONTENT)
async def remove_container_placement(
    container_id: UUID, principal: PrincipalDep, session: SessionDep
) -> None:
    container = await require(session, Container, container_id, "Container")
    area = await require(session, Area, container.area_id, "Area")
    await require_household_access(area.household_id, principal, session)
    placement = await session.scalar(
        select(ContainerPlacement).where(ContainerPlacement.container_id == container_id)
    )
    if placement is not None:
        placement_id = placement.id
        await session.delete(placement)
        await session.commit()
        await realtime_hub.publish(area.household_id, entity="container-placement", action="deleted", entity_id=placement_id, source=principal.method)


@router.patch("/containers/{container_id}/space", response_model=ContainerRead)
async def set_container_space(
    container_id: UUID,
    is_out_of_space: bool,
    principal: PrincipalDep,
    session: SessionDep,
) -> Container:
    container = await require(session, Container, container_id, "Container")
    area = await require(session, Area, container.area_id, "Area")
    await require_household_access(area.household_id, principal, session)
    container.is_out_of_space = is_out_of_space
    await session.commit()
    await session.refresh(container)
    await realtime_hub.publish(area.household_id, entity="container", action="updated", entity_id=container.id, source=principal.method)
    return container
