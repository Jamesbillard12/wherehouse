from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse

import pytest

from app.api.dependencies import Principal
from app.api.v1.routes import backups
from app.core.config import Settings
from app.infrastructure.backups.dropbox_credentials import DropboxCredentialStore


class OwnerSession:
    async def scalar(self, _query):
        return "membership-id"


def principal() -> Principal:
    return Principal(user=SimpleNamespace(id="user-id"), method="user_session")


@pytest.mark.asyncio
async def test_connect_callback_and_disconnect_oauth_flow(monkeypatch, tmp_path) -> None:
    settings = Settings(
        dropbox_app_key="app-key",
        dropbox_credential_file=str(tmp_path / "dropbox.json"),
        dropbox_redirect_uri="https://wherehouse.example/api/v1/backups/providers/dropbox/callback",
    )
    monkeypatch.setattr(backups, "get_settings", lambda: settings)
    connected = await backups.connect_dropbox(principal(), OwnerSession())
    query = parse_qs(urlparse(connected["authorization_url"]).query)

    assert query["client_id"] == ["app-key"]
    assert query["code_challenge_method"] == ["S256"]
    assert "code_verifier" not in connected["authorization_url"]
    assert "refresh" not in connected["authorization_url"]

    monkeypatch.setattr(backups, "exchange_dropbox_code", lambda _fields: "refresh-secret")
    response = await backups.dropbox_callback(code="authorization-code", state=query["state"][0])
    assert response.status_code == 303
    assert DropboxCredentialStore(settings.dropbox_credential_file).load() == "refresh-secret"

    await backups.disconnect_dropbox(principal(), OwnerSession())
    assert DropboxCredentialStore(settings.dropbox_credential_file).load() is None


@pytest.mark.asyncio
async def test_oauth_state_is_single_use(monkeypatch, tmp_path) -> None:
    settings = Settings(
        dropbox_app_key="app-key",
        dropbox_credential_file=str(tmp_path / "dropbox.json"),
    )
    monkeypatch.setattr(backups, "get_settings", lambda: settings)
    with pytest.raises(Exception) as error:
        await backups.dropbox_callback(code="code", state="unknown")
    assert error.value.status_code == 400
