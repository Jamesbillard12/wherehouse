from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.application.context import ActorContext
from app.application.devices.capabilities import (
    DeviceAccessDenied,
    DeviceNotFound,
    RevokeDevice,
    revoke_device,
)
from app.models import HouseholdRelationship


class DeviceSession:
    def __init__(self, device=None, membership=None) -> None:
        self.device = device
        self.membership = membership
        self.commit = AsyncMock()
        self.rollback = AsyncMock()

    async def get(self, _model, _id):
        return self.device

    async def scalar(self, _query):
        return self.membership


class Events:
    def __init__(self) -> None:
        self.calls = []

    async def revoke_device(self, household_id, device_id, revoked_at) -> None:
        self.calls.append((household_id, device_id, revoked_at))


def actor(user_id):
    return ActorContext(user_id=user_id, client="test")


async def test_revoke_device_commits_before_publishing_and_is_idempotent() -> None:
    user_id, household_id, device_id = uuid4(), uuid4(), uuid4()
    device = SimpleNamespace(
        id=device_id, household_id=household_id, is_active=True, revoked_at=None
    )
    membership = SimpleNamespace(relationship_type=HouseholdRelationship.OWNER)
    session = DeviceSession(device, membership)
    events = Events()

    await revoke_device(session, actor(user_id), RevokeDevice(device_id), events)

    session.commit.assert_awaited_once()
    assert device.is_active is False
    assert device.revoked_at is not None
    assert events.calls == [(household_id, device_id, device.revoked_at)]

    await revoke_device(session, actor(user_id), RevokeDevice(device_id), events)
    session.commit.assert_awaited_once()
    assert len(events.calls) == 1


async def test_revoke_device_does_not_publish_when_commit_fails() -> None:
    device = SimpleNamespace(id=uuid4(), household_id=uuid4(), is_active=True, revoked_at=None)
    session = DeviceSession(
        device, SimpleNamespace(relationship_type=HouseholdRelationship.OWNER)
    )
    session.commit.side_effect = RuntimeError("commit failed")
    events = Events()

    with pytest.raises(RuntimeError, match="commit failed"):
        await revoke_device(session, actor(uuid4()), RevokeDevice(device.id), events)

    session.rollback.assert_awaited_once()
    assert events.calls == []


async def test_revoke_device_enforces_owner_and_presence() -> None:
    device = SimpleNamespace(id=uuid4(), household_id=uuid4(), is_active=True, revoked_at=None)
    events = Events()
    with pytest.raises(DeviceAccessDenied):
        await revoke_device(
            DeviceSession(device, SimpleNamespace(relationship_type=HouseholdRelationship.BORROWER)),
            actor(uuid4()),
            RevokeDevice(device.id),
            events,
        )
    with pytest.raises(DeviceNotFound):
        await revoke_device(DeviceSession(), actor(uuid4()), RevokeDevice(uuid4()), events)
