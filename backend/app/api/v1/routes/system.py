from fastapi import APIRouter, HTTPException

from app.api.dependencies import SessionDep
from app.application.system.status import read_system_status
from app.core.config import get_settings

router = APIRouter()


@router.get("/system/status")
async def system_status(session: SessionDep) -> dict:
    try:
        status = await read_system_status(session, get_settings())
    except Exception as exc:
        raise HTTPException(status_code=503, detail="WhereHouse is not ready") from exc
    return status.public_dict()
