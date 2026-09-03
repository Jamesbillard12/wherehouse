import asyncio

from fastapi import APIRouter, HTTPException

from app.api.dependencies import PrincipalDep, SessionDep
from app.api.v1.routes.backups import require_instance_owner
from app.application.system.status import read_system_status
from app.core.config import get_settings
from app.infrastructure.appliance_updates import ApplianceUpdateClient

router = APIRouter()


@router.get("/system/status")
async def system_status(session: SessionDep) -> dict:
    try:
        status = await read_system_status(session, get_settings())
    except Exception as exc:
        raise HTTPException(status_code=503, detail="WhereHouse is not ready") from exc
    return status.public_dict()


def update_client() -> ApplianceUpdateClient:
    return ApplianceUpdateClient(get_settings().appliance_update_socket)


async def update_request(operation: str) -> dict:
    try:
        return await asyncio.to_thread(update_client().request, operation)
    except RuntimeError as exc:
        if "already running" in str(exc):
            raise HTTPException(status_code=409, detail="An appliance operation is already running") from exc
        raise HTTPException(status_code=503, detail="Appliance update service is unavailable") from exc
    except (OSError, ValueError) as exc:
        raise HTTPException(status_code=503, detail="Appliance update service is unavailable") from exc


@router.get("/system/update")
async def update_status(principal: PrincipalDep) -> dict:
    return await update_request("status")


@router.post("/system/update/check")
async def check_update(principal: PrincipalDep, session: SessionDep) -> dict:
    await require_instance_owner(principal, session)
    return await update_request("check")


@router.post("/system/update/install", status_code=202)
async def install_update(principal: PrincipalDep, session: SessionDep) -> dict:
    await require_instance_owner(principal, session)
    return await update_request("install")
