import asyncio
from collections import defaultdict
from datetime import UTC, datetime
from uuid import UUID

from fastapi import WebSocket, WebSocketDisconnect


class RealtimeHub:
    """Process-local workspace event fan-out for connected clients."""

    def __init__(self) -> None:
        self._connections: dict[UUID, set[WebSocket]] = defaultdict(set)
        self._device_connections: dict[UUID, set[WebSocket]] = defaultdict(set)
        self._connection_devices: dict[WebSocket, UUID] = {}
        self._lock = asyncio.Lock()

    async def connect(
        self, workspace_id: UUID, websocket: WebSocket, *, device_id: UUID | None = None
    ) -> None:
        async with self._lock:
            self._connections[workspace_id].add(websocket)
            if device_id is not None:
                self._device_connections[device_id].add(websocket)
                self._connection_devices[websocket] = device_id

    async def disconnect(self, workspace_id: UUID, websocket: WebSocket) -> None:
        async with self._lock:
            connections = self._connections.get(workspace_id)
            if connections is None:
                return
            connections.discard(websocket)
            if not connections:
                self._connections.pop(workspace_id, None)
            device_id = self._connection_devices.pop(websocket, None)
            if device_id is not None:
                device_connections = self._device_connections.get(device_id)
                if device_connections is not None:
                    device_connections.discard(websocket)
                    if not device_connections:
                        self._device_connections.pop(device_id, None)

    async def revoke_device(
        self, workspace_id: UUID, device_id: UUID, revoked_at: datetime
    ) -> None:
        """Notify and close only sockets authenticated by the revoked device."""
        event = {
            "type": "device.revoked",
            "workspace_id": str(workspace_id),
            "household_id": str(workspace_id),
            "device_id": str(device_id),
            "occurred_at": revoked_at.isoformat(),
        }
        async with self._lock:
            connections = tuple(self._device_connections.get(device_id, ()))
        for websocket in connections:
            try:
                await websocket.send_json(event)
                await websocket.close(code=4403, reason="Device access revoked")
            except (RuntimeError, WebSocketDisconnect):
                pass

    async def publish(
        self, workspace_id: UUID, *, entity: str, action: str, entity_id: UUID, source: str,
        event_type: str = "inventory.changed", details: dict[str, str] | None = None,
    ) -> None:
        event = {
            "type": event_type,
            "workspace_id": str(workspace_id),
            "household_id": str(workspace_id),
            "entity": entity,
            "action": action,
            "entity_id": str(entity_id),
            "source": source,
            "occurred_at": datetime.now(UTC).isoformat(),
        }
        if details:
            event.update(details)
        async with self._lock:
            connections = tuple(self._connections.get(workspace_id, ()))
        stale: list[WebSocket] = []
        for websocket in connections:
            try:
                await websocket.send_json(event)
            except (RuntimeError, WebSocketDisconnect):
                stale.append(websocket)
        for websocket in stale:
            await self.disconnect(workspace_id, websocket)


realtime_hub = RealtimeHub()
