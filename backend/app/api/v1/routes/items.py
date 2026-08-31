from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import Response
from sqlalchemy import select

from app.api.dependencies import PrincipalDep, SessionDep, require_household_access
from app.models import Area, Container, Item, ItemPlacement, Zone
from app.repositories.entities import require_entity as require
from app.schemas.core import (
    ItemCreate,
    ItemPlacementCreate,
    ItemPlacementRead,
    ItemRead,
    ItemUpdate,
)
from app.services.container_codes import next_item_code
from app.services.image_storage import get_image_storage
from app.services.realtime import realtime_hub

router = APIRouter()

ITEM_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MAX_ITEM_IMAGE_BYTES = 8 * 1024 * 1024

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
    item = Item(household_id=household_id, code=await next_item_code(session), **payload.model_dump())
    session.add(item)
    await session.commit()
    await session.refresh(item)
    await realtime_hub.publish(household_id, entity="item", action="created", entity_id=item.id, source=principal.method)
    return item


@router.patch("/items/{item_id}", response_model=ItemRead)
async def update_item(
    item_id: UUID,
    payload: ItemUpdate,
    principal: PrincipalDep,
    session: SessionDep,
) -> Item:
    item = await require(session, Item, item_id, "Item")
    await require_household_access(item.household_id, principal, session)
    for field, value in payload.model_dump().items():
        setattr(item, field, value)
    await session.commit()
    await session.refresh(item)
    await realtime_hub.publish(item.household_id, entity="item", action="updated", entity_id=item.id, source=principal.method)
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
    await realtime_hub.publish(item.household_id, entity="item", action="image.updated", entity_id=item.id, source=principal.method)
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
    await realtime_hub.publish(item.household_id, entity="item-placement", action="updated", entity_id=placement.id, source=principal.method)
    return placement
