from uuid import UUID

from fastapi import APIRouter, status
from sqlalchemy import select

from app.api.dependencies import PrincipalDep, SessionDep, require_workspace_access
from app.application.context import ActorContext
from app.application.workspaces.capabilities import CreateWorkspace
from app.application.workspaces.capabilities import create_workspace as create
from app.models import User, Workspace, WorkspaceMembership
from app.repositories.entities import require_entity as require
from app.schemas.core import (
    WorkspaceCreate,
    WorkspaceMembershipCreate,
    WorkspaceMembershipRead,
    WorkspaceRead,
)

router = APIRouter()

@router.post(
    "/households",
    response_model=WorkspaceRead,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
@router.post("/workspaces", response_model=WorkspaceRead, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    payload: WorkspaceCreate, principal: PrincipalDep, session: SessionDep
) -> Workspace:
    return await create(
        session,
        ActorContext(
            user_id=principal.user.id,
            client=principal.method,
            device_id=principal.device_id,
            workspace_id=principal.device_workspace_id,
        ),
        CreateWorkspace(payload.name),
    )


@router.get("/households", response_model=list[WorkspaceRead], include_in_schema=False)
@router.get("/workspaces", response_model=list[WorkspaceRead])
async def list_workspaces(principal: PrincipalDep, session: SessionDep) -> list[Workspace]:
    query = (
        select(Workspace)
        .join(WorkspaceMembership)
        .where(WorkspaceMembership.user_id == principal.user.id)
        .order_by(Workspace.name)
    )
    if principal.device_workspace_id is not None:
        query = query.where(Workspace.id == principal.device_workspace_id)
    result = await session.scalars(query)
    return list(result)


@router.post(
    "/households/{workspace_id}/users",
    response_model=WorkspaceMembershipRead,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
@router.post(
    "/workspaces/{workspace_id}/users",
    response_model=WorkspaceMembershipRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_workspace_user(
    workspace_id: UUID,
    payload: WorkspaceMembershipCreate,
    principal: PrincipalDep,
    session: SessionDep,
) -> WorkspaceMembership:
    await require_workspace_access(workspace_id, principal, session, owner=True)
    await require(session, User, payload.user_id, "User")
    membership = WorkspaceMembership(
        workspace_id=workspace_id,
        user_id=payload.user_id,
        role=payload.role,
    )
    session.add(membership)
    await session.commit()
    await session.refresh(membership)
    return membership
