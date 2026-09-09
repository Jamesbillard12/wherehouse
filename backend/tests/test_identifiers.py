from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.api.v1.routes import identifiers as identifier_routes
from app.application.context import ActorContext
from app.application.identifiers import capabilities as identifier_capabilities
from app.application.identifiers.capabilities import (
    IdentifierAccessDenied,
    IdentifierNotFound,
    InvalidIdentifierTransition,
    RegisterIdentifier,
    activate_identifier,
    activate_pending_nfc_identifier,
    create_identifier,
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
        self.flushes = 0
        self.refreshes = 0

    async def scalar(self, _statement):
        self.scalar_calls += 1
        if self.scalar_calls == 1 and self.target is not None:
            return self.identifier
        if self.scalar_calls == (2 if self.target is not None else 1):
            return self.membership
        return None

    async def get(self, model, _identifier):
        return self.identifier if model is PhysicalIdentifier else self.target

    async def commit(self):
        self.commits += 1

    async def flush(self):
        self.flushes += 1

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


async def test_nfc_creation_issues_pending_replacement_instead_of_reusing_active(monkeypatch) -> None:
    workspace_id = uuid4()
    target = SimpleNamespace()
    session = SimpleNamespace(
        scalar=AsyncMock(return_value=None),
        add=lambda _value: None,
        commit=AsyncMock(),
        refresh=AsyncMock(),
    )
    monkeypatch.setattr(identifier_capabilities, "_target", AsyncMock(return_value=(target, workspace_id)))
    monkeypatch.setattr(identifier_capabilities, "_require_access", AsyncMock())

    value, returned_target = await create_identifier(
        session,
        actor(),
        RegisterIdentifier(IdentifierTargetType.ITEM, uuid4(), IdentifierMedium.NFC),
    )

    assert returned_target is target
    assert value.status is IdentifierStatus.PENDING
    assert value.workspace_id == workspace_id
    session.scalar.assert_awaited_once()


async def test_activation_is_idempotent_after_success() -> None:
    value = identifier(IdentifierStatus.ACTIVE)
    session = IdentifierSession(value)
    assert await activate_identifier(session, actor(), value.id) is value
    assert session.commits == 0


async def test_revoked_identifier_cannot_be_reactivated() -> None:
    value = identifier(IdentifierStatus.REVOKED)
    with pytest.raises(InvalidIdentifierTransition, match="cannot be activated"):
        await activate_identifier(IdentifierSession(value), actor(), value.id)


async def test_activation_revokes_previous_identifier_for_same_target_and_medium() -> None:
    value = identifier(IdentifierStatus.PENDING)
    previous = identifier(IdentifierStatus.ACTIVE)
    previous.target_id = value.target_id
    previous.workspace_id = value.workspace_id
    session = IdentifierSession(value)
    session.scalar = AsyncMock(side_effect=[session.membership, previous])

    assert await activate_identifier(session, actor(), value.id) is value

    assert value.status is IdentifierStatus.ACTIVE
    assert previous.status is IdentifierStatus.REVOKED
    assert session.flushes == 1
    assert session.commits == 1


async def test_pending_nfc_identifier_can_be_recovered_by_public_id() -> None:
    value = identifier(IdentifierStatus.PENDING)
    session = IdentifierSession(value)
    session.scalar = AsyncMock(side_effect=[value, session.membership, None])

    assert await activate_pending_nfc_identifier(session, actor(), value.public_id) is value

    assert value.status is IdentifierStatus.ACTIVE
    assert session.commits == 1


async def test_non_pending_identifier_cannot_be_recovered_by_public_id() -> None:
    session = IdentifierSession()
    session.scalar = AsyncMock(return_value=None)

    with pytest.raises(IdentifierNotFound, match="Pending NFC"):
        await activate_pending_nfc_identifier(session, actor(), "idn_missing")


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


async def test_workspace_identifier_list_returns_active_records_after_access_check(monkeypatch) -> None:
    workspace_id = uuid4()
    value = identifier(IdentifierStatus.ACTIVE)
    value.workspace_id = workspace_id
    value.created_at = datetime.now(UTC)
    value.updated_at = value.created_at
    require_access = AsyncMock()
    monkeypatch.setattr(identifier_routes, "require_workspace_access", require_access)
    session = SimpleNamespace(scalars=AsyncMock(return_value=[value]))
    principal = SimpleNamespace()

    result = await identifier_routes.list_workspace_identifiers(
        workspace_id, principal, session
    )

    require_access.assert_awaited_once_with(workspace_id, principal, session)
    assert result[0]["id"] == value.id
    assert result[0]["medium"] is IdentifierMedium.NFC
