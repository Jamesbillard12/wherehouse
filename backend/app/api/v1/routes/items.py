from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import Response
from sqlalchemy import select

from app.api.dependencies import PrincipalDep, SessionDep, require_workspace_access
from app.application.context import ActorContext
from app.application.items.capabilities import (
    CreateItem,
    EntityNotFound,
    IdempotencyConflict,
    InvalidMove,
    ItemDestination,
    MoveItem,
    SearchItems,
    UpdateItem,
    WorkspaceAccessDenied,
    move_item,
    resolve_item_locations,
    search_items,
)
from app.application.items.capabilities import (
    create_item as create_item_capability,
)
from app.application.items.capabilities import delete_item as delete_item_capability
from app.application.items.capabilities import (
    update_item as update_item_capability,
)
from app.models import Item, ItemPlacement
from app.repositories.entities import require_entity as require
from app.schemas.core import (
    ItemCreate,
    ItemPlacementCreate,
    ItemPlacementRead,
    ItemRead,
    ItemSearchResult,
    ItemUpdate,
)
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
    "/households/{workspace_id}/items",
    response_model=ItemRead,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
@router.post(
    "/workspaces/{workspace_id}/items",
    response_model=ItemRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_item(
    workspace_id: UUID,
    payload: ItemCreate,
    principal: PrincipalDep,
    session: SessionDep,
) -> Item:
    actor = ActorContext(
        user_id=principal.user.id,
        client=principal.method,
        device_id=principal.device_id,
        workspace_id=None,
    )
    try:
        return await create_item_capability(
            session,
            actor,
            workspace_id,
            CreateItem(
                **payload.model_dump(exclude={"placement"}),
                placement=ItemDestination(**payload.placement.model_dump()) if payload.placement else None,
            ),
            realtime_hub,
        )
    except WorkspaceAccessDenied as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error)) from error
    except IdempotencyConflict as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except EntityNotFound as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except InvalidMove as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


@router.patch("/items/{item_id}", response_model=ItemRead)
async def update_item(
    item_id: UUID,
    payload: ItemUpdate,
    principal: PrincipalDep,
    session: SessionDep,
) -> Item:
    actor = ActorContext(
        user_id=principal.user.id,
        client=principal.method,
        device_id=principal.device_id,
        workspace_id=None,
    )
    try:
        return await update_item_capability(
            session,
            actor,
            item_id,
            UpdateItem(
                **payload.model_dump(exclude={"placement"}),
                placement=ItemDestination(**payload.placement.model_dump()) if payload.placement else None,
            ),
            realtime_hub,
        )
    except EntityNotFound as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except WorkspaceAccessDenied as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error)) from error
    except InvalidMove as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    item_id: UUID,
    principal: PrincipalDep,
    session: SessionDep,
) -> Response:
    actor = ActorContext(
        user_id=principal.user.id,
        client=principal.method,
        device_id=principal.device_id,
        workspace_id=None,
    )
    try:
        await delete_item_capability(session, actor, item_id, realtime_hub)
    except EntityNotFound as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except WorkspaceAccessDenied as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error)) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/households/{workspace_id}/items",
    response_model=list[ItemRead],
    include_in_schema=False,
)
@router.get("/workspaces/{workspace_id}/items", response_model=list[ItemRead])
async def list_items(
    workspace_id: UUID, principal: PrincipalDep, session: SessionDep
) -> list[Item]:
    await require_workspace_access(workspace_id, principal, session)
    result = await session.scalars(
        select(Item)
        .where(Item.workspace_id == workspace_id, Item.is_archived.is_(False))
        .order_by(Item.name)
    )
    return list(result)


@router.get(
    "/households/{workspace_id}/items/search",
    response_model=list[ItemSearchResult],
    include_in_schema=False,
)
@router.get("/workspaces/{workspace_id}/items/search", response_model=list[ItemSearchResult])
async def search_workspace_items(
    workspace_id: UUID,
    q: str,
    principal: PrincipalDep,
    session: SessionDep,
) -> list[ItemSearchResult]:
    actor = ActorContext(user_id=principal.user.id, client=principal.method, device_id=principal.device_id, workspace_id=workspace_id)
    try:
        matches = await search_items(session, actor, workspace_id, SearchItems(query=q))
    except WorkspaceAccessDenied as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    return [ItemSearchResult(item=ItemRead.model_validate(match.item), resolved_path=match.resolved_path) for match in matches]


@router.put("/items/{item_id}/image", response_model=ItemRead)
async def upload_item_image(
    item_id: UUID,
    request: Request,
    principal: PrincipalDep,
    session: SessionDep,
) -> Item:
    item = await require(session, Item, item_id, "Item")
    await require_workspace_access(item.workspace_id, principal, session)
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
    object_key = f"workspaces/{item.workspace_id}/items/{item.id}{extension}"
    storage.put(object_key, body, content_type)
    item.image_path = object_key
    await session.commit()
    await session.refresh(item)
    await realtime_hub.publish(item.workspace_id, entity="item", action="image.updated", entity_id=item.id, source=principal.method)
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
    await require_workspace_access(item.workspace_id, principal, session)
    if not item.image_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item image not found")
    stored = get_image_storage().get(item.image_path)
    if stored is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item image not found")
    return Response(
        content=stored.content,
        media_type=stored.content_type,
        headers={"Cache-Control": "private, no-store"},
    )


@router.get(
    "/households/{workspace_id}/item-placements",
    response_model=list[ItemPlacementRead],
    include_in_schema=False,
)
@router.get(
    "/workspaces/{workspace_id}/item-placements",
    response_model=list[ItemPlacementRead],
)
async def list_item_placements(
    workspace_id: UUID, principal: PrincipalDep, session: SessionDep
) -> list[ItemPlacementRead]:
    await require_workspace_access(workspace_id, principal, session)
    result = await session.scalars(
        select(ItemPlacement)
        .join(Item, Item.id == ItemPlacement.item_id)
        .where(Item.workspace_id == workspace_id)
        .order_by(ItemPlacement.created_at)
    )
    actor = ActorContext(
        user_id=principal.user.id,
        client=principal.method,
        device_id=principal.device_id,
        workspace_id=workspace_id,
    )
    placements = list(result)
    try:
        paths = await resolve_item_locations(session, actor, workspace_id, placements)
        return [
            ItemPlacementRead.model_validate(placement).model_copy(
                update={"resolved_path": paths[placement.id]}
            )
            for placement in placements
        ]
    except InvalidMove as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.put("/items/{item_id}/placement", response_model=ItemPlacementRead)
async def place_item(
    item_id: UUID,
    payload: ItemPlacementCreate,
    principal: PrincipalDep,
    session: SessionDep,
) -> ItemPlacement:
    actor = ActorContext(
        user_id=principal.user.id,
        client=principal.method,
        device_id=principal.device_id,
        workspace_id=None,
    )
    try:
        return await move_item(
            session,
            actor,
            MoveItem(item_id=item_id, **payload.model_dump()),
            realtime_hub,
        )
    except EntityNotFound as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except WorkspaceAccessDenied as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error)) from error
    except InvalidMove as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
