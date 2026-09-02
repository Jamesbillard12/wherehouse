from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import secrets
import time
from importlib.metadata import version
from pathlib import Path
from urllib import error, parse, request

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy import select

from app.api.dependencies import PrincipalDep, SessionDep
from app.application.backups.artifact import create_artifact
from app.application.backups.cli import (
    canonical_media_keys,
    provider_from_settings,
    schema_revision,
)
from app.application.backups.errors import BackupError
from app.application.backups.media import SelectedMediaRepository
from app.application.backups.service import BackupService
from app.application.backups.status import destination_status, summarize
from app.core.config import get_settings
from app.infrastructure.backups import DropboxBackupProvider, LocalBackupProvider, PostgresBackup
from app.infrastructure.backups.dropbox_credentials import DropboxCredentialStore
from app.models import HouseholdRelationship, HouseholdUser
from app.schemas.backups import BackupStatusRead
from app.services.image_storage import get_image_storage

router = APIRouter()
_oauth_states: dict[str, tuple[float, str]] = {}


def exchange_dropbox_code(fields: dict[str, str]) -> str | None:
    with request.urlopen(
        request.Request(
            "https://api.dropboxapi.com/oauth2/token",
            data=parse.urlencode(fields).encode(),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        ),
        timeout=30,
    ) as response:
        return json.loads(response.read()).get("refresh_token")


async def require_instance_owner(principal: PrincipalDep, session: SessionDep) -> None:
    owner = await session.scalar(
        select(HouseholdUser.id).where(
            HouseholdUser.user_id == principal.user.id,
            HouseholdUser.relationship_type == HouseholdRelationship.OWNER,
        )
    )
    if owner is None:
        raise HTTPException(status_code=403, detail="Instance owner access required")


def current_status():
    settings = get_settings()
    local = LocalBackupProvider(settings.backup_local_dir)
    credential_store = DropboxCredentialStore(settings.dropbox_credential_file)
    refresh_token = credential_store.load() or settings.dropbox_refresh_token
    dropbox_configured = bool(settings.dropbox_app_key and refresh_token)
    dropbox = (
        DropboxBackupProvider(
            settings.dropbox_app_key or "",
            refresh_token or "",
            settings.dropbox_app_secret,
            settings.dropbox_backup_folder,
        )
        if dropbox_configured
        else None
    )
    return summarize(
        [
            destination_status(
                kind="remote",
                provider_name="dropbox",
                display_name="Dropbox",
                management="web",
                configured=dropbox_configured,
                provider=dropbox,
            ),
            destination_status(
                kind="local",
                provider_name="local",
                display_name="External storage",
                management="cli",
                configured=Path(settings.backup_local_dir).expanduser().is_dir(),
                provider=local,
            ),
        ]
    )


@router.get("/backups/status", response_model=BackupStatusRead)
async def backup_status(_principal: PrincipalDep) -> BackupStatusRead:
    status = await asyncio.to_thread(current_status)
    return BackupStatusRead.model_validate(status, from_attributes=True)


@router.post("/backups/providers/{provider_name}/run", status_code=202)
async def run_remote_backup(
    provider_name: str, principal: PrincipalDep, session: SessionDep
) -> dict[str, str | int]:
    if provider_name != "dropbox":
        raise HTTPException(status_code=404, detail="Remote backup provider is not supported")
    await require_instance_owner(principal, session)
    settings = get_settings()
    try:
        provider = provider_from_settings(provider_name)
        keys = await canonical_media_keys()
        media = SelectedMediaRepository(get_image_storage(), keys)
        artifact = await asyncio.to_thread(
            create_artifact,
            Path(settings.backup_staging_dir),
            PostgresBackup(settings.database_url),
            media,
            schema_revision(),
            version("wherehouse-api"),
        )
        stored = await asyncio.to_thread(BackupService(provider).store, artifact)
        return {"key": stored.key, "size": stored.size}
    except BackupError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@router.post("/backups/providers/dropbox/connect")
async def connect_dropbox(principal: PrincipalDep, session: SessionDep) -> dict[str, str]:
    await require_instance_owner(principal, session)
    settings = get_settings()
    if not settings.dropbox_app_key:
        raise HTTPException(status_code=503, detail="Dropbox app key is not configured")
    now = time.monotonic()
    for expired_state, (expires_at, _) in list(_oauth_states.items()):
        if expires_at < now:
            _oauth_states.pop(expired_state, None)
    state = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(64)
    _oauth_states[state] = (now + 600, verifier)
    challenge = (
        base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    )
    query = parse.urlencode(
        {
            "client_id": settings.dropbox_app_key,
            "response_type": "code",
            "redirect_uri": settings.dropbox_redirect_uri,
            "token_access_type": "offline",
            "code_challenge_method": "S256",
            "code_challenge": challenge,
            "state": state,
        }
    )
    return {"authorization_url": f"https://www.dropbox.com/oauth2/authorize?{query}"}


@router.get("/backups/providers/dropbox/callback", include_in_schema=False)
async def dropbox_callback(code: str = Query(), state: str = Query()) -> RedirectResponse:
    pending = _oauth_states.pop(state, None)
    if pending is None or pending[0] < time.monotonic():
        raise HTTPException(status_code=400, detail="Dropbox authorization expired; start again")
    settings = get_settings()
    fields = {
        "code": code,
        "grant_type": "authorization_code",
        "client_id": settings.dropbox_app_key or "",
        "redirect_uri": settings.dropbox_redirect_uri,
        "code_verifier": pending[1],
    }
    if settings.dropbox_app_secret:
        fields["client_secret"] = settings.dropbox_app_secret
    try:
        refresh_token = await asyncio.to_thread(exchange_dropbox_code, fields)
    except (error.HTTPError, error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=502, detail="Dropbox authorization could not be completed"
        ) from exc
    if not refresh_token:
        raise HTTPException(status_code=502, detail="Dropbox did not provide offline authorization")
    DropboxCredentialStore(settings.dropbox_credential_file).save(refresh_token)
    return RedirectResponse(url="/settings/backups?dropbox=connected", status_code=303)


@router.delete("/backups/providers/dropbox", status_code=204)
async def disconnect_dropbox(principal: PrincipalDep, session: SessionDep) -> None:
    await require_instance_owner(principal, session)
    settings = get_settings()
    if settings.dropbox_refresh_token:
        raise HTTPException(
            status_code=409,
            detail="Dropbox is configured by environment; remove it from server configuration",
        )
    DropboxCredentialStore(settings.dropbox_credential_file).delete()
