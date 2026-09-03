from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path, PurePosixPath
from urllib import error, parse, request

from app.application.backups.errors import BackupProviderError
from app.application.backups.models import ARTIFACT_SUFFIX, StoredBackup


class DropboxBackupProvider:
    API = "https://api.dropboxapi.com/2"
    CONTENT = "https://content.dropboxapi.com/2"
    SIMPLE_UPLOAD_LIMIT = 150 * 1024 * 1024
    CHUNK_SIZE = 8 * 1024 * 1024

    def __init__(
        self,
        app_key: str,
        refresh_token: str,
        app_secret: str | None = None,
        folder: str = "/WhereHouse/Backups",
        timeout: float = 60,
    ) -> None:
        if not app_key or not refresh_token:
            raise BackupProviderError("Dropbox app key and refresh token are required")
        normalized = "/" + folder.strip("/")
        if ".." in PurePosixPath(normalized).parts:
            raise BackupProviderError("Invalid Dropbox backup folder")
        self.app_key = app_key
        self.app_secret = app_secret
        self.refresh_token = refresh_token
        self.folder = normalized
        self.timeout = timeout

    def _access_token(self) -> str:
        fields = {
            "grant_type": "refresh_token",
            "refresh_token": self.refresh_token,
            "client_id": self.app_key,
        }
        if self.app_secret:
            fields["client_secret"] = self.app_secret
        response = self._request(
            "https://api.dropboxapi.com/oauth2/token",
            data=parse.urlencode(fields).encode(),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            authenticated=False,
        )
        token = response.get("access_token")
        if not token:
            raise BackupProviderError("Dropbox authorization did not return an access token")
        return token

    def _request(
        self,
        url: str,
        data: bytes = b"",
        headers: dict[str, str] | None = None,
        authenticated: bool = True,
        raw: bool = False,
    ):
        headers = dict(headers or {})
        if authenticated:
            headers["Authorization"] = f"Bearer {self._access_token()}"
        try:
            with request.urlopen(
                request.Request(url, data=data, headers=headers), timeout=self.timeout
            ) as response:
                payload = response.read()
                return payload if raw else json.loads(payload or b"{}")
        except error.HTTPError as exc:
            category = {
                401: "Dropbox authorization was rejected; reconnect Dropbox",
                409: "Dropbox path or object conflict",
                429: "Dropbox rate limit reached; retry later",
                507: "Dropbox storage quota is exhausted",
            }.get(exc.code, f"Dropbox request failed ({exc.code})")
            raise BackupProviderError(category) from exc
        except (error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise BackupProviderError(f"Dropbox connection failed: {exc}") from exc

    def _remote_path(self, key: str) -> str:
        if not key or PurePosixPath(key).name != key:
            raise BackupProviderError("Backup key must be a filename")
        return f"{self.folder}/{key}"

    def store(self, source: Path, key: str) -> StoredBackup:
        remote_path = self._remote_path(key)
        size = source.stat().st_size
        if size <= self.SIMPLE_UPLOAD_LIMIT:
            result = self._request(
                f"{self.CONTENT}/files/upload",
                data=source.read_bytes(),
                headers={
                    "Content-Type": "application/octet-stream",
                    "Dropbox-API-Arg": json.dumps(
                        {"path": remote_path, "mode": "overwrite", "autorename": False}
                    ),
                },
            )
        else:
            result = self._upload_session(source, remote_path)
        return self._metadata(result)

    def _upload_session(self, source: Path, remote_path: str) -> dict:
        with source.open("rb") as handle:
            first = handle.read(self.CHUNK_SIZE)
            started = self._request(
                f"{self.CONTENT}/files/upload_session/start",
                data=first,
                headers={
                    "Content-Type": "application/octet-stream",
                    "Dropbox-API-Arg": json.dumps({"close": False}),
                },
            )
            session_id = started["session_id"]
            offset = len(first)
            while True:
                chunk = handle.read(self.CHUNK_SIZE)
                following = handle.read(1)
                cursor = {"session_id": session_id, "offset": offset}
                if following:
                    chunk += following
                    self._request(
                        f"{self.CONTENT}/files/upload_session/append_v2",
                        data=chunk,
                        headers={
                            "Content-Type": "application/octet-stream",
                            "Dropbox-API-Arg": json.dumps({"cursor": cursor, "close": False}),
                        },
                    )
                    offset += len(chunk)
                    continue
                return self._request(
                    f"{self.CONTENT}/files/upload_session/finish",
                    data=chunk,
                    headers={
                        "Content-Type": "application/octet-stream",
                        "Dropbox-API-Arg": json.dumps(
                            {
                                "cursor": cursor,
                                "commit": {
                                    "path": remote_path,
                                    "mode": "overwrite",
                                    "autorename": False,
                                },
                            }
                        ),
                    },
                )

    def list(self) -> list[StoredBackup]:
        body = {"path": self.folder, "recursive": False, "include_deleted": False}
        try:
            response = self._request(
                f"{self.API}/files/list_folder",
                json.dumps(body).encode(),
                {"Content-Type": "application/json"},
            )
        except BackupProviderError as exc:
            if "path or object conflict" in str(exc):
                return []
            raise
        entries = response.get("entries", [])
        while response.get("has_more"):
            response = self._request(
                f"{self.API}/files/list_folder/continue",
                json.dumps({"cursor": response["cursor"]}).encode(),
                {"Content-Type": "application/json"},
            )
            entries.extend(response.get("entries", []))
        return sorted(
            (
                self._metadata(item)
                for item in entries
                if item.get(".tag") == "file" and item.get("name", "").endswith(ARTIFACT_SUFFIX)
            ),
            key=lambda item: (item.modified_at or datetime.min.replace(tzinfo=UTC), item.key),
            reverse=True,
        )

    def retrieve(self, key: str, destination: Path) -> Path:
        temporary = destination.with_name(f".{destination.name}.incomplete")
        destination.parent.mkdir(parents=True, exist_ok=True)
        try:
            content = self._request(
                f"{self.CONTENT}/files/download",
                headers={"Dropbox-API-Arg": json.dumps({"path": self._remote_path(key)})},
                raw=True,
            )
            temporary.write_bytes(content)
            temporary.replace(destination)
            return destination
        finally:
            temporary.unlink(missing_ok=True)

    def delete(self, key: str) -> None:
        self._request(
            f"{self.API}/files/delete_v2",
            json.dumps({"path": self._remote_path(key)}).encode(),
            {"Content-Type": "application/json"},
        )

    @staticmethod
    def _metadata(item: dict) -> StoredBackup:
        modified = item.get("server_modified")
        return StoredBackup(
            key=item.get("name") or PurePosixPath(item["path_display"]).name,
            size=int(item.get("size", 0)),
            modified_at=datetime.fromisoformat(modified) if modified else None,
        )
