import asyncio
from uuid import UUID

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, ValidationError

from app.api.dependencies import SessionDep, authenticate_token, require_household_access
from app.services.realtime import realtime_hub

router = APIRouter()


class RealtimeAuthentication(BaseModel):
    type: str
    token: str
    household_id: UUID


@router.websocket("/realtime")
async def realtime(websocket: WebSocket, session: SessionDep) -> None:
    await websocket.accept()
    household_id: UUID | None = None
    try:
        raw = await asyncio.wait_for(websocket.receive_json(), timeout=10)
        authentication = RealtimeAuthentication.model_validate(raw)
        if authentication.type != "authenticate":
            await websocket.close(code=4401, reason="Authentication required")
            return
        principal = await authenticate_token(authentication.token, session)
        await require_household_access(authentication.household_id, principal, session)
        household_id = authentication.household_id
        await realtime_hub.connect(household_id, websocket)
        await websocket.send_json({"type": "realtime.ready", "household_id": str(household_id)})
        while True:
            message = await websocket.receive_json()
            if message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except (TimeoutError, ValidationError):
        await websocket.close(code=4401, reason="Authentication required")
    except HTTPException as error:
        await websocket.close(code=4403 if error.status_code == 403 else 4401, reason=error.detail)
    except WebSocketDisconnect:
        pass
    finally:
        if household_id is not None:
            await realtime_hub.disconnect(household_id, websocket)
