from __future__ import annotations

import os
import shutil
from datetime import UTC, datetime
from pathlib import Path

from app.application.backups.errors import BackupProviderError
from app.application.backups.models import ARTIFACT_SUFFIX, StoredBackup


class LocalBackupProvider:
    """Stores finalized artifacts on a local filesystem or mounted external volume."""

    def __init__(self, root: str | Path) -> None:
        self.root = Path(root).expanduser().resolve()

    def _require_root(self) -> None:
        if not self.root.is_dir():
            raise BackupProviderError(f"Backup destination is missing or not mounted: {self.root}")
        if not os.access(self.root, os.W_OK):
            raise BackupProviderError(f"Backup destination is not writable: {self.root}")

    def _path(self, key: str) -> Path:
        if not key or Path(key).name != key:
            raise BackupProviderError("Backup key must be a filename")
        path = (self.root / key).resolve()
        if not path.is_relative_to(self.root):
            raise BackupProviderError("Invalid backup key")
        return path

    def store(self, source: Path, key: str) -> StoredBackup:
        self._require_root()
        target = self._path(key)
        temporary = target.with_name(f".{target.name}.incomplete")
        try:
            free = shutil.disk_usage(self.root).free
            if free < source.stat().st_size:
                raise BackupProviderError("Insufficient space at backup destination")
            with source.open("rb") as input_file, temporary.open("xb") as output_file:
                shutil.copyfileobj(input_file, output_file, length=1024 * 1024)
                output_file.flush()
                os.fsync(output_file.fileno())
            os.replace(temporary, target)
            return self._metadata(target)
        except BackupProviderError:
            raise
        except OSError as error:
            raise BackupProviderError(
                f"Could not store local backup: {error.strerror or error}"
            ) from error
        finally:
            temporary.unlink(missing_ok=True)

    def list(self) -> list[StoredBackup]:
        self._require_root()
        return sorted(
            (
                self._metadata(path)
                for path in self.root.glob(f"*{ARTIFACT_SUFFIX}")
                if path.is_file()
            ),
            key=lambda item: (item.modified_at or datetime.min.replace(tzinfo=UTC), item.key),
            reverse=True,
        )

    def retrieve(self, key: str, destination: Path) -> Path:
        source = self._path(key)
        if not source.is_file():
            raise BackupProviderError(f"Backup does not exist: {key}")
        temporary = destination.with_name(f".{destination.name}.incomplete")
        destination.parent.mkdir(parents=True, exist_ok=True)
        try:
            shutil.copyfile(source, temporary)
            os.replace(temporary, destination)
            return destination
        except OSError as error:
            raise BackupProviderError(
                f"Could not retrieve local backup: {error.strerror or error}"
            ) from error
        finally:
            temporary.unlink(missing_ok=True)

    def delete(self, key: str) -> None:
        path = self._path(key)
        if not path.is_file():
            raise BackupProviderError(f"Backup does not exist: {key}")
        try:
            path.unlink()
        except OSError as error:
            raise BackupProviderError(
                f"Could not delete local backup: {error.strerror or error}"
            ) from error

    @staticmethod
    def _metadata(path: Path) -> StoredBackup:
        stat = path.stat()
        return StoredBackup(
            key=path.name,
            size=stat.st_size,
            modified_at=datetime.fromtimestamp(stat.st_mtime, tz=UTC),
        )
