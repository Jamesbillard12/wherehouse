from typing import Any, cast
from uuid import uuid4

from fastapi import WebSocket

from app.services.realtime import RealtimeHub


class RecordingWebSocket:
    def __init__(self) -> None:
        self.messages: list[dict[str, Any]] = []

    async def send_json(self, message: dict[str, Any]) -> None:
        self.messages.append(message)


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
