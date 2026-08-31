import asyncio
from collections import defaultdict
from datetime import UTC, datetime
from uuid import UUID

from fastapi import WebSocket, WebSocketDisconnect


class RealtimeHub:
    """Process-local household event fan-out for connected clients."""

    def __init__(self) -> None:
        self._connections: dict[UUID, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, household_id: UUID, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections[household_id].add(websocket)

    async def disconnect(self, household_id: UUID, websocket: WebSocket) -> None:
        async with self._lock:
            connections = self._connections.get(household_id)
            if connections is None:
                return
            connections.discard(websocket)
            if not connections:
                self._connections.pop(household_id, None)

    async def publish(
        self, household_id: UUID, *, entity: str, action: str, entity_id: UUID, source: str
    ) -> None:
        event = {
            "type": "inventory.changed",
            "household_id": str(household_id),
            "entity": entity,
            "action": action,
            "entity_id": str(entity_id),
            "source": source,
            "occurred_at": datetime.now(UTC).isoformat(),
        }
        async with self._lock:
            connections = tuple(self._connections.get(household_id, ()))
        stale: list[WebSocket] = []
        for websocket in connections:
            try:
                await websocket.send_json(event)
            except (RuntimeError, WebSocketDisconnect):
                stale.append(websocket)
        for websocket in stale:
            await self.disconnect(household_id, websocket)


realtime_hub = RealtimeHub()
