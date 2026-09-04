from __future__ import annotations

import os
import platform
import shutil
from dataclasses import asdict, dataclass
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path
from typing import Literal

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.models import User, Workspace

StorageState = Literal["healthy", "low_space", "critical", "unavailable", "not_writable"]


@dataclass(frozen=True)
class StorageHealth:
    state: StorageState
    mounted: bool
    writable: bool
    free_bytes: int | None
    total_bytes: int | None
    message: str


@dataclass(frozen=True)
class SystemStatus:
    ready: bool
    initialized: bool
    instance_id: str | None
    hostname: str
    application_version: str
    schema_version: str | None
    image_version: str | None
    build_date: str | None
    device_model: str | None
    os_version: str
    storage: StorageHealth
    account_count: int
    workspace_count: int
    capabilities: dict[str, bool]

    def public_dict(self) -> dict:
        return asdict(self)


def classify_storage(path: Path, warning_bytes: int, critical_bytes: int) -> StorageHealth:
    try:
        path.mkdir(parents=True, exist_ok=True)
        mounted = path.is_mount() or any(parent.is_mount() for parent in [path, *path.parents])
        writable = os.access(path, os.W_OK)
        usage = shutil.disk_usage(path)
    except OSError:
        return StorageHealth("unavailable", False, False, None, None, "Storage is unavailable.")
    if not writable:
        return StorageHealth(
            "not_writable", mounted, False, usage.free, usage.total, "Storage is not writable."
        )
    if usage.free < critical_bytes:
        return StorageHealth(
            "critical", mounted, True, usage.free, usage.total, "Free space is critically low."
        )
    if usage.free < warning_bytes:
        return StorageHealth(
            "low_space", mounted, True, usage.free, usage.total, "Free space is running low."
        )
    return StorageHealth("healthy", mounted, True, usage.free, usage.total, "Storage is healthy.")


def device_model() -> str | None:
    try:
        return Path("/proc/device-tree/model").read_text().rstrip("\x00\n")
    except OSError:
        return None


async def read_system_status(session: AsyncSession, settings: Settings) -> SystemStatus:
    await session.execute(text("SELECT 1"))
    account_count = int(await session.scalar(select(func.count(User.id))) or 0)
    workspace_count = int(await session.scalar(select(func.count(Workspace.id))) or 0)
    revision = await session.scalar(text("SELECT version_num FROM alembic_version LIMIT 1"))
    storage = classify_storage(
        Path(settings.appliance_data_dir),
        settings.storage_warning_free_bytes,
        settings.storage_critical_free_bytes,
    )
    try:
        app_version = version("wherehouse-api")
    except PackageNotFoundError:
        app_version = "development"
    initialized = account_count > 0 and workspace_count > 0
    return SystemStatus(
        ready=storage.state not in {"unavailable", "not_writable", "critical"},
        initialized=initialized,
        instance_id=settings.instance_id,
        hostname=settings.appliance_hostname,
        application_version=settings.wherehouse_version or app_version,
        schema_version=str(revision) if revision else None,
        image_version=settings.appliance_image_version,
        build_date=settings.appliance_build_date,
        device_model=device_model(),
        os_version=platform.platform(),
        storage=storage,
        account_count=account_count,
        workspace_count=workspace_count,
        capabilities={"storageManagement": settings.storage_management_enabled,
                      "networkStorage": settings.storage_management_enabled},
    )


def ensure_operation_space(path: Path, required_bytes: int) -> None:
    try:
        free = shutil.disk_usage(path).free
    except OSError as exc:
        raise RuntimeError("Storage is unavailable; the operation was not started.") from exc
    if free < required_bytes:
        raise RuntimeError(
            f"Insufficient free space: {free} bytes available, {required_bytes} bytes required."
        )
