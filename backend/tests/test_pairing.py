from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api.v1.auth import build_pairing_uri, consume_pairing
from app.models import Device, DeviceType
from app.schemas.auth import PairingConsume


class PairingSessionStub:
    def __init__(self, pairing, instance=None) -> None:
        self.results = [pairing, instance]
        self.added = []
        self.committed = False

    async def scalar(self, _query):
        return self.results.pop(0)

    def add(self, value) -> None:
        self.added.append(value)

    async def flush(self) -> None:
        for value in self.added:
            if isinstance(value, Device) and value.id is None:
                value.id = uuid4()

    async def commit(self) -> None:
        self.committed = True

    async def rollback(self) -> None:
        pass


def payload() -> PairingConsume:
    return PairingConsume(token="pair_abcdefghijklmnopqrstuvwxyz", device_name="iPhone", device_type=DeviceType.PHONE)


def pairing(*, expires_at=None, consumed_at=None):
    return SimpleNamespace(
        workspace_id=uuid4(),
        created_by_user_id=uuid4(),
        expires_at=expires_at or datetime.now(UTC) + timedelta(minutes=10),
        consumed_at=consumed_at,
        consumed_by_device_id=None,
    )


def test_pairing_uri_is_versioned_and_contains_the_reachable_server_and_token() -> None:
    uri = build_pairing_uri("http://wherehouse.local/", "pair_secret")
    parsed = urlparse(uri)
    query = parse_qs(parsed.query)

    assert (parsed.scheme, parsed.netloc) == ("wherehouse", "pair")
    assert query == {
        "type": ["wherehouse-pairing"],
        "version": ["1"],
        "server": ["http://wherehouse.local"],
        "token": ["pair_secret"],
    }


@pytest.mark.parametrize(
    "pairing_record",
    [None, pairing(expires_at=datetime.now(UTC) - timedelta(seconds=1)), pairing(consumed_at=datetime.now(UTC))],
)
async def test_pairing_rejects_invalid_expired_and_consumed_tokens(pairing_record) -> None:
    with pytest.raises(HTTPException) as error:
        await consume_pairing(payload(), PairingSessionStub(pairing_record))

    assert error.value.status_code == 400


async def test_pairing_creates_and_returns_a_workspace_scoped_device() -> None:
    pairing_record = pairing()
    instance = SimpleNamespace(id=uuid4(), name="Home WhereHouse", base_url="http://wherehouse.local")
    session = PairingSessionStub(pairing_record, instance)

    result = await consume_pairing(payload(), session)

    device = session.added[0]
    assert isinstance(device, Device)
    assert device.workspace_id == pairing_record.workspace_id
    assert device.user_id == pairing_record.created_by_user_id
    assert result.device_id == device.id
    assert result.workspace_id == pairing_record.workspace_id
    assert result.base_url == instance.base_url
    assert pairing_record.consumed_at is not None
    assert pairing_record.consumed_by_device_id == device.id
    assert session.committed is True


async def test_revoked_device_does_not_prevent_a_new_registration() -> None:
    old_device = SimpleNamespace(id=uuid4(), is_active=False, revoked_at=datetime.now(UTC))
    pairing_record = pairing()
    instance = SimpleNamespace(id=uuid4(), name="Home WhereHouse", base_url="http://wherehouse.local")
    session = PairingSessionStub(pairing_record, instance)

    result = await consume_pairing(payload(), session)

    assert result.device_id != old_device.id
    assert isinstance(session.added[0], Device)
