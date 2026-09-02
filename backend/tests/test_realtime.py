from typing import Any, cast
from uuid import uuid4

from fastapi import WebSocket

from app.services.realtime import RealtimeHub


class RecordingWebSocket:
    def __init__(self) -> None:
        self.messages: list[dict[str, Any]] = []
        self.closed: tuple[int, str] | None = None

    async def send_json(self, message: dict[str, Any]) -> None:
        self.messages.append(message)

    async def close(self, code: int, reason: str) -> None:
        self.closed = (code, reason)


async def test_hub_scopes_inventory_events_to_household() -> None:
    hub = RealtimeHub()
    first_household = uuid4()
    second_household = uuid4()
    first = RecordingWebSocket()
    second = RecordingWebSocket()
    await hub.connect(first_household, cast(WebSocket, first))
    await hub.connect(second_household, cast(WebSocket, second))

    item_id = uuid4()
    await hub.publish(first_household, entity="item", action="updated", entity_id=item_id, source="device")

    assert len(first.messages) == 1
    assert first.messages[0]["household_id"] == str(first_household)
    assert first.messages[0]["entity_id"] == str(item_id)
    assert second.messages == []


async def test_hub_stops_delivery_after_disconnect() -> None:
    hub = RealtimeHub()
    household_id = uuid4()
    websocket = RecordingWebSocket()
    typed_websocket = cast(WebSocket, websocket)
    await hub.connect(household_id, typed_websocket)
    await hub.disconnect(household_id, typed_websocket)

    await hub.publish(household_id, entity="area", action="deleted", entity_id=uuid4(), source="user_session")

    assert websocket.messages == []


async def test_hub_publishes_identifier_resolution_context() -> None:
    hub = RealtimeHub()
    household_id = uuid4()
    websocket = RecordingWebSocket()
    await hub.connect(household_id, cast(WebSocket, websocket))
    container_id = uuid4()
    area_id = uuid4()

    await hub.publish(
        household_id,
        entity="container",
        action="resolved",
        entity_id=container_id,
        source="device",
        event_type="identifier.resolved",
        details={"area_id": str(area_id)},
    )

    assert websocket.messages[0]["type"] == "identifier.resolved"
    assert websocket.messages[0]["entity_id"] == str(container_id)
    assert websocket.messages[0]["area_id"] == str(area_id)


async def test_hub_targets_and_closes_only_the_revoked_device() -> None:
    hub = RealtimeHub()
    household_id = uuid4()
    revoked_device_id = uuid4()
    other_device_id = uuid4()
    revoked = RecordingWebSocket()
    other = RecordingWebSocket()
    await hub.connect(
        household_id, cast(WebSocket, revoked), device_id=revoked_device_id
    )
    await hub.connect(household_id, cast(WebSocket, other), device_id=other_device_id)

    from datetime import UTC, datetime

    await hub.revoke_device(household_id, revoked_device_id, datetime.now(UTC))

    assert revoked.messages[0]["type"] == "device.revoked"
    assert revoked.messages[0]["device_id"] == str(revoked_device_id)
    assert revoked.closed == (4403, "Device access revoked")
    assert other.messages == []
    assert other.closed is None
