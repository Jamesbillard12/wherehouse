from __future__ import annotations

from pathlib import Path
from typing import Protocol

from app.application.backups.models import StoredBackup
from app.services.image_storage import StoredImage


class BackupProvider(Protocol):
    def store(self, source: Path, key: str) -> StoredBackup: ...

    def list(self) -> list[StoredBackup]: ...

    def retrieve(self, key: str, destination: Path) -> Path: ...

    def delete(self, key: str) -> None: ...


class DatabaseBackup(Protocol):
    def create_snapshot(self, destination: Path) -> None: ...

    def restore_snapshot(self, source: Path) -> None: ...


class MediaRepository(Protocol):
    def list_keys(self) -> list[str]: ...

    def get(self, key: str) -> StoredImage | None: ...

    def put(self, key: str, content: bytes, content_type: str) -> None: ...
