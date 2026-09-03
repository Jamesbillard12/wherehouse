from __future__ import annotations

import json
from pathlib import Path
from urllib import error

import pytest

from app.application.backups.errors import BackupProviderError
from app.infrastructure.backups.dropbox import DropboxBackupProvider


class RecordingDropbox(DropboxBackupProvider):
    def __init__(self) -> None:
        super().__init__("app-key", "refresh-token", folder="/WhereHouse/Backups")
        self.calls: list[tuple[str, bytes, dict[str, str], bool]] = []

    def _request(self, url, data=b"", headers=None, authenticated=True, raw=False):
        self.calls.append((url, data, headers or {}, raw))
        if url.endswith("/files/upload"):
            return {
                "name": "one.whbackup",
                "size": len(data),
                "server_modified": "2026-09-02T12:00:00Z",
            }
        if url.endswith("/files/list_folder"):
            return {
                "entries": [
                    {
                        ".tag": "file",
                        "name": "one.whbackup",
                        "size": 7,
                        "server_modified": "2026-09-02T12:00:00Z",
                    },
                    {".tag": "file", "name": "notes.txt", "size": 1},
                ],
                "has_more": False,
            }
        if url.endswith("/files/download"):
            return b"content"
        return {}


def test_dropbox_upload_list_download_delete_mapping(tmp_path: Path) -> None:
    provider = RecordingDropbox()
    source = tmp_path / "one.whbackup"
    source.write_bytes(b"content")

    stored = provider.store(source, source.name)
    listed = provider.list()
    retrieved = provider.retrieve(source.name, tmp_path / "retrieved.whbackup")
    provider.delete(source.name)

    assert stored.key == "one.whbackup"
    assert [item.key for item in listed] == ["one.whbackup"]
    assert retrieved.read_bytes() == b"content"
    upload_arg = json.loads(provider.calls[0][2]["Dropbox-API-Arg"])
    assert upload_arg["path"] == "/WhereHouse/Backups/one.whbackup"
    assert upload_arg["mode"] == "overwrite"
    assert any(call[0].endswith("/files/delete_v2") for call in provider.calls)


def test_dropbox_refresh_token_request_does_not_expose_token_in_url() -> None:
    provider = DropboxBackupProvider("app-key", "refresh-token", "app-secret")
    captured = {}

    def request_token(url, data=b"", headers=None, authenticated=True, raw=False):
        captured.update(url=url, data=data, headers=headers, authenticated=authenticated)
        return {"access_token": "short-lived"}

    provider._request = request_token  # type: ignore[method-assign]
    assert provider._access_token() == "short-lived"
    assert "refresh-token" not in captured["url"]
    assert captured["authenticated"] is False
    assert b"refresh_token=refresh-token" in captured["data"]


def test_dropbox_translates_authorization_and_network_errors(monkeypatch) -> None:
    provider = DropboxBackupProvider("app-key", "refresh-token")

    def unauthorized(*_args, **_kwargs):
        raise error.HTTPError("https://dropbox", 401, "unauthorized", {}, None)

    monkeypatch.setattr("urllib.request.urlopen", unauthorized)
    with pytest.raises(BackupProviderError, match="reconnect Dropbox"):
        provider._request("https://dropbox", authenticated=False)

    def disconnected(*_args, **_kwargs):
        raise error.URLError("offline")

    monkeypatch.setattr("urllib.request.urlopen", disconnected)
    with pytest.raises(BackupProviderError, match="connection failed"):
        provider._request("https://dropbox", authenticated=False)
