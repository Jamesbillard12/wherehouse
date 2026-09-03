from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Protocol
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.context import ActorContext
from app.models import Device, WorkspaceMembership, WorkspaceRole


class DeviceNotFound(Exception):
    pass


class DeviceAccessDenied(Exception):
    pass


class DeviceRevocationEvents(Protocol):
    async def revoke_device(self, workspace_id: UUID, device_id: UUID, revoked_at: datetime) -> None: ...


@dataclass(frozen=True)
class RevokeDevice:
    device_id: UUID


async def revoke_device(
    session: AsyncSession,
    actor: ActorContext,
    command: RevokeDevice,
    events: DeviceRevocationEvents,
) -> Device:
    """Idempotently revoke one device and notify it only after commit succeeds."""
    device = await session.get(Device, command.device_id)
    if device is None:
        raise DeviceNotFound("Device not found")
    membership = await session.scalar(
        select(WorkspaceMembership).where(
            WorkspaceMembership.workspace_id == device.workspace_id,
            WorkspaceMembership.user_id == actor.user_id,
        )
    )
    if membership is None or membership.role is not WorkspaceRole.OWNER:
        raise DeviceAccessDenied("Workspace access denied")
    if not device.is_active or device.revoked_at is not None:
        return device

    revoked_at = datetime.now(UTC)
    device.is_active = False
    device.revoked_at = revoked_at
    try:
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    await events.revoke_device(device.workspace_id, device.id, revoked_at)
    return device
