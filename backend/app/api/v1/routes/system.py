import asyncio

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from app.api.dependencies import PrincipalDep, SessionDep
from app.api.v1.routes.backups import require_instance_owner
from app.application.system.status import read_system_status
from app.core.config import get_settings
from app.infrastructure.appliance_updates import ApplianceUpdateClient
from app.models import WorkspaceMembership, WorkspaceRole

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


async def appliance_request(operation: str, payload: dict | None = None) -> dict:
    try:
        return await asyncio.to_thread(update_client().request, operation, payload)
    except RuntimeError as exc:
        if "already running" in str(exc):
            raise HTTPException(status_code=409, detail="An appliance operation is already running") from exc
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except (OSError, ValueError) as exc:
        raise HTTPException(status_code=503, detail="Appliance storage service is unavailable") from exc


async def require_appliance_owner(principal: PrincipalDep, session: SessionDep) -> None:
    owners = int(await session.scalar(select(func.count(WorkspaceMembership.id)).where(
        WorkspaceMembership.role == WorkspaceRole.OWNER)) or 0)
    if owners == 0 and principal.method == "user_session":
        return
    await require_instance_owner(principal, session)


class PrepareStorageRequest(BaseModel):
    device_id: str = Field(min_length=1, max_length=128)
    expected_device_id: str = Field(min_length=1, max_length=128)
    confirmation: str = Field(max_length=64)


class MigrateStorageRequest(BaseModel):
    filesystem_uuid: str = Field(min_length=4, max_length=64)


class EnableNasRequest(BaseModel):
    username: str = Field(min_length=1, max_length=31)
    password: str = Field(min_length=12, max_length=128)


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


@router.get("/system/storage")
async def storage_status(principal: PrincipalDep) -> dict:
    return await appliance_request("storage.status")


@router.post("/system/storage/prepare")
async def prepare_storage(body: PrepareStorageRequest, principal: PrincipalDep, session: SessionDep) -> dict:
    await require_appliance_owner(principal, session)
    return await appliance_request("storage.prepare", {"deviceId": body.device_id,
        "expectedDeviceId": body.expected_device_id, "confirmation": body.confirmation})


@router.post("/system/storage/migrate")
async def migrate_storage(body: MigrateStorageRequest, principal: PrincipalDep, session: SessionDep) -> dict:
    await require_appliance_owner(principal, session)
    return await appliance_request("storage.migrate", {"filesystemUuid": body.filesystem_uuid})


@router.post("/system/nas/enable")
async def enable_nas(body: EnableNasRequest, principal: PrincipalDep, session: SessionDep) -> dict:
    await require_appliance_owner(principal, session)
    return await appliance_request("nas.enable", body.model_dump())


@router.post("/system/nas/disable")
async def disable_nas(principal: PrincipalDep, session: SessionDep) -> dict:
    await require_appliance_owner(principal, session)
    return await appliance_request("nas.disable")
