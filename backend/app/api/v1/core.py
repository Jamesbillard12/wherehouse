from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import Response
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import PrincipalDep, SessionDep, require_household_access
from app.models import (
    Area,
    Container,
    ContainerPlacement,
    Household,
    HouseholdRelationship,
    HouseholdUser,
    Item,
    ItemPlacement,
    User,
    Zone,
)
from app.schemas.core import (
    AreaCreate,
    AreaRead,
    AreaUpdate,
    ContainerCreate,
    ContainerPlacementCreate,
    ContainerPlacementRead,
    ContainerRead,
    ContainerUpdate,
    HouseholdCreate,
    HouseholdRead,
    HouseholdUserCreate,
    HouseholdUserRead,
    ItemCreate,
    ItemPlacementCreate,
    ItemPlacementRead,
    ItemRead,
    ZoneCreate,
    ZoneRead,
    ZoneUpdate,
)
from app.services.image_storage import get_image_storage

router = APIRouter()

ITEM_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MAX_ITEM_IMAGE_BYTES = 8 * 1024 * 1024

CONTAINER_CODE_PREFIXES = {
    "bin": "BIN",
    "box": "BOX",
    "shelf": "SHF",
    "shelving_unit": "SHU",
    "cabinet": "CAB",
    "drawer": "DRW",
    "toolbox": "TLB",
    "bag": "BAG",
    "case": "CSE",
    "rack": "RCK",
    "hook": "HOK",
    "workbench": "WRK",
    "other": "OTH",
}


async def next_container_code(session: AsyncSession, container_type: str) -> str:
    number = await session.scalar(text("SELECT nextval('container_code_number_seq')"))
    prefix = CONTAINER_CODE_PREFIXES[container_type]
    return f"{prefix}-{number:06d}"


async def require(session: AsyncSession, model: type, entity_id: UUID, label: str):
    entity = await session.get(model, entity_id)
    if entity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{label} not found")
    return entity


@router.post("/households", response_model=HouseholdRead, status_code=status.HTTP_201_CREATED)
async def create_household(
    payload: HouseholdCreate, principal: PrincipalDep, session: SessionDep
) -> Household:
    household = Household(name=payload.name)
    session.add(household)
    await session.flush()
    session.add(
        HouseholdUser(
            household_id=household.id,
            user_id=principal.user.id,
            relationship_type=HouseholdRelationship.OWNER,
        )
    )
    await session.commit()
    await session.refresh(household)
    return household


@router.get("/households", response_model=list[HouseholdRead])
async def list_households(principal: PrincipalDep, session: SessionDep) -> list[Household]:
    query = (
        select(Household)
        .join(HouseholdUser)
        .where(HouseholdUser.user_id == principal.user.id)
        .order_by(Household.name)
    )
    if principal.device_household_id is not None:
        query = query.where(Household.id == principal.device_household_id)
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
    return area


@router.delete("/areas/{area_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_area(area_id: UUID, principal: PrincipalDep, session: SessionDep) -> None:
    area = await require(session, Area, area_id, "Area")
    await require_household_access(area.household_id, principal, session)
    await session.delete(area)
    await session.commit()


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
    return container


@router.delete("/containers/{container_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_container(
    container_id: UUID, principal: PrincipalDep, session: SessionDep
) -> None:
    container = await require(session, Container, container_id, "Container")
    area = await require(session, Area, container.area_id, "Area")
    await require_household_access(area.household_id, principal, session)
    await session.delete(container)
    await session.commit()


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
        await session.delete(placement)
        await session.commit()


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
    return container


@router.post(
    "/households/{household_id}/items",
    response_model=ItemRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_item(
    household_id: UUID,
    payload: ItemCreate,
    principal: PrincipalDep,
    session: SessionDep,
) -> Item:
    await require_household_access(household_id, principal, session)
    item = Item(household_id=household_id, **payload.model_dump())
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return item


@router.get("/households/{household_id}/items", response_model=list[ItemRead])
async def list_items(
    household_id: UUID, principal: PrincipalDep, session: SessionDep
) -> list[Item]:
    await require_household_access(household_id, principal, session)
    result = await session.scalars(
        select(Item)
        .where(Item.household_id == household_id, Item.is_archived.is_(False))
        .order_by(Item.name)
    )
    return list(result)


@router.put("/items/{item_id}/image", response_model=ItemRead)
async def upload_item_image(
    item_id: UUID,
    request: Request,
    principal: PrincipalDep,
    session: SessionDep,
) -> Item:
    item = await require(session, Item, item_id, "Item")
    await require_household_access(item.household_id, principal, session)
    content_type = request.headers.get("content-type", "").split(";", 1)[0].lower()
    extension = ITEM_IMAGE_TYPES.get(content_type)
    if extension is None:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Item images must be JPEG, PNG, or WebP.",
        )
    body = await request.body()
    if not body or len(body) > MAX_ITEM_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Item images must be between 1 byte and 8 MB.",
        )
    storage = get_image_storage()
    previous_key = item.image_path
    object_key = f"households/{item.household_id}/items/{item.id}{extension}"
    storage.put(object_key, body, content_type)
    item.image_path = object_key
    await session.commit()
    await session.refresh(item)
    if previous_key and previous_key != object_key:
        storage.delete(previous_key)
    return item


@router.get("/items/{item_id}/image")
async def get_item_image(
    item_id: UUID,
    principal: PrincipalDep,
    session: SessionDep,
) -> Response:
    item = await require(session, Item, item_id, "Item")
    await require_household_access(item.household_id, principal, session)
    if not item.image_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item image not found")
    stored = get_image_storage().get(item.image_path)
    if stored is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item image not found")
    return Response(
        content=stored.content,
        media_type=stored.content_type,
        headers={"Cache-Control": "private, max-age=3600"},
    )


@router.get(
    "/households/{household_id}/item-placements",
    response_model=list[ItemPlacementRead],
)
async def list_item_placements(
    household_id: UUID, principal: PrincipalDep, session: SessionDep
) -> list[ItemPlacement]:
    await require_household_access(household_id, principal, session)
    result = await session.scalars(
        select(ItemPlacement)
        .join(Item, Item.id == ItemPlacement.item_id)
        .where(Item.household_id == household_id)
        .order_by(ItemPlacement.created_at)
    )
    return list(result)


@router.put("/items/{item_id}/placement", response_model=ItemPlacementRead)
async def place_item(
    item_id: UUID,
    payload: ItemPlacementCreate,
    principal: PrincipalDep,
    session: SessionDep,
) -> ItemPlacement:
    item = await require(session, Item, item_id, "Item")
    await require_household_access(item.household_id, principal, session)

    if payload.area_id is not None:
        area = await require(session, Area, payload.area_id, "Area")
        household_id = area.household_id
    elif payload.zone_id is not None:
        zone = await require(session, Zone, payload.zone_id, "Zone")
        area = await require(session, Area, zone.area_id, "Area")
        household_id = area.household_id
    else:
        container = await require(session, Container, payload.container_id, "Container")
        area = await require(session, Area, container.area_id, "Area")
        household_id = area.household_id

    if household_id != item.household_id:
        raise HTTPException(
            status_code=400, detail="Item and destination must belong to the same household"
        )

    placement = await session.scalar(select(ItemPlacement).where(ItemPlacement.item_id == item_id))
    values = payload.model_dump()
    if placement is None:
        placement = ItemPlacement(item_id=item_id, **values)
        session.add(placement)
    else:
        for field, value in values.items():
            setattr(placement, field, value)

    await session.commit()
    await session.refresh(placement)
    return placement
