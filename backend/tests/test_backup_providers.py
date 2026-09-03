from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from app.application.backups.artifact import create_artifact
from app.application.backups.errors import BackupProviderError
from app.application.backups.models import StoredBackup
from app.application.backups.service import BackupService
from app.infrastructure.backups.local import LocalBackupProvider
from app.services.image_storage import StoredImage


def test_local_provider_store_list_retrieve_delete(tmp_path: Path) -> None:
    root = tmp_path / "destination"
    root.mkdir()
    source = tmp_path / "source.whbackup"
    source.write_bytes(b"artifact")
    provider = LocalBackupProvider(root)

    stored = provider.store(source, "backup.whbackup")
    assert stored.size == 8
    assert [item.key for item in provider.list()] == ["backup.whbackup"]
    retrieved = provider.retrieve("backup.whbackup", tmp_path / "retrieved.whbackup")
    assert retrieved.read_bytes() == b"artifact"
    provider.delete("backup.whbackup")
    assert provider.list() == []


def test_local_provider_requires_existing_destination(tmp_path: Path) -> None:
    provider = LocalBackupProvider(tmp_path / "unmounted")
    with pytest.raises(BackupProviderError, match="missing or not mounted"):
        provider.list()


def test_portable_artifact_round_trips_through_local_provider(tmp_path: Path) -> None:
    class Database:
        def create_snapshot(self, destination: Path) -> None:
            destination.write_bytes(b"database")

    class Media:
        def list_keys(self) -> list[str]:
            return ["items/image.jpg"]

        def get(self, _key: str) -> StoredImage:
            return StoredImage(b"image", "image/jpeg")

    staging = tmp_path / "staging"
    destination = tmp_path / "external-volume"
    destination.mkdir()
    artifact = create_artifact(staging, Database(), Media(), "0012", "0.0.1")  # type: ignore[arg-type]
    service = BackupService(LocalBackupProvider(destination))

    stored = service.store(artifact)
    verified = service.retrieve(stored.key, tmp_path / "retrieved.whbackup")

    assert verified.media_count == 1
    assert artifact.is_file()


class CatalogProvider:
    def __init__(self) -> None:
        now = datetime.now(UTC)
        self.items = [
            StoredBackup(f"{index}.whbackup", index, now - timedelta(days=index))
            for index in range(4)
        ]
        self.deleted: list[str] = []

    def list(self) -> list[StoredBackup]:
        return self.items

    def delete(self, key: str) -> None:
        self.deleted.append(key)


def test_retention_is_decided_by_core_service() -> None:
    provider = CatalogProvider()
    deleted = BackupService(provider).prune(2)  # type: ignore[arg-type]
    assert deleted == ["2.whbackup", "3.whbackup"]
    assert provider.deleted == deleted


def test_retention_rejects_zero() -> None:
    with pytest.raises(ValueError):
        BackupService(CatalogProvider()).prune(0)  # type: ignore[arg-type]
