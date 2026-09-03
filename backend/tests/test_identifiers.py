from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.application.context import ActorContext
from app.application.identifiers.capabilities import (
    IdentifierAccessDenied,
    IdentifierNotFound,
    InvalidIdentifierTransition,
    activate_identifier,
    identifier_payload,
    resolve_identifier,
    revoke_identifier,
)
from app.models import Item, PhysicalIdentifier
from app.models.core import IdentifierMedium, IdentifierStatus, IdentifierTargetType


def test_identifier_payload_is_versioned_and_opaque() -> None:
    payload = identifier_payload("idn_example-token")
    assert payload == "wherehouse://identify/v1/idn_example-token"
    assert "workspace" not in payload


class IdentifierSession:
    def __init__(self, identifier=None, membership=None, target=None):
        self.identifier = identifier
        self.membership = SimpleNamespace() if membership is None else membership
        self.target = target
        self.scalar_calls = 0
        self.commits = 0
        self.refreshes = 0

    async def scalar(self, _statement):
        self.scalar_calls += 1
        return self.identifier if self.scalar_calls == 1 and self.target is not None else self.membership

    async def get(self, model, _identifier):
        return self.identifier if model is PhysicalIdentifier else self.target

    async def commit(self):
        self.commits += 1

    async def refresh(self, _value):
        self.refreshes += 1


def actor(workspace_id=None):
    return ActorContext(user_id=uuid4(), client="test", workspace_id=workspace_id)


def identifier(status=IdentifierStatus.PENDING):
    return PhysicalIdentifier(
        id=uuid4(), workspace_id=uuid4(), public_id="idn_test",
        target_type=IdentifierTargetType.ITEM, target_id=uuid4(),
        medium=IdentifierMedium.NFC, status=status, payload_version=1,
    )


async def test_activation_is_idempotent_after_success() -> None:
    value = identifier(IdentifierStatus.ACTIVE)
    session = IdentifierSession(value)
    assert await activate_identifier(session, actor(), value.id) is value
    assert session.commits == 0


async def test_revoked_identifier_cannot_be_reactivated() -> None:
    value = identifier(IdentifierStatus.REVOKED)
    with pytest.raises(InvalidIdentifierTransition, match="cannot be activated"):
        await activate_identifier(IdentifierSession(value), actor(), value.id)


async def test_revoke_is_idempotent() -> None:
    value = identifier(IdentifierStatus.REVOKED)
    session = IdentifierSession(value)
    assert await revoke_identifier(session, actor(), value.id) is value
    assert session.commits == 0


async def test_device_workspace_boundary_is_enforced_before_membership_lookup() -> None:
    value = identifier()
    session = IdentifierSession(value)
    with pytest.raises(IdentifierAccessDenied):
        await activate_identifier(session, actor(uuid4()), value.id)
    assert session.scalar_calls == 0


async def test_revoked_identifier_does_not_resolve() -> None:
    session = IdentifierSession(identifier=None, membership=None, target=SimpleNamespace())
    with pytest.raises(IdentifierNotFound):
        await resolve_identifier(session, actor(), "idn_revoked")


async def test_identifier_target_must_remain_in_same_workspace() -> None:
    value = identifier(IdentifierStatus.ACTIVE)
    target = Item(id=value.target_id, workspace_id=uuid4(), name="Drill", code="ITM-001", quantity=1)
    session = IdentifierSession(value, membership=SimpleNamespace(), target=target)
    with pytest.raises(IdentifierNotFound, match="target"):
        await resolve_identifier(session, actor(), value.public_id)
