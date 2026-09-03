from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.context import ActorContext
from app.models import Workspace, WorkspaceMembership, WorkspaceRole, WorkspaceType


class InvalidWorkspace(Exception):
    pass


@dataclass(frozen=True)
class CreateWorkspace:
    name: str


async def create_workspace(
    session: AsyncSession, actor: ActorContext, command: CreateWorkspace
) -> Workspace:
    name = command.name.strip()
    if actor.workspace_id is not None:
        raise InvalidWorkspace("Workspace-scoped device credentials cannot create workspaces")
    if not name:
        raise InvalidWorkspace("Workspace name is required")
    workspace = Workspace(name=name, workspace_type=WorkspaceType.HOUSEHOLD)
    session.add(workspace)
    try:
        await session.flush()
        session.add(
            WorkspaceMembership(
                workspace_id=workspace.id,
                user_id=actor.user_id,
                role=WorkspaceRole.OWNER,
            )
        )
        await session.commit()
        await session.refresh(workspace)
    except Exception:
        await session.rollback()
        raise
    return workspace
