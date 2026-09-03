from __future__ import annotations

import json
import zipfile
from pathlib import Path

import pytest

from app.application.backups.artifact import create_artifact, verify_artifact
from app.application.backups.errors import (
    BackupCompatibilityError,
    BackupIntegrityError,
    RestoreSafetyError,
)
from app.application.backups.service import BackupService
from app.services.image_storage import StoredImage


class FakeDatabase:
    restored: bytes | None = None

    def create_snapshot(self, destination: Path) -> None:
        destination.write_bytes(b"consistent postgres snapshot")

    def restore_snapshot(self, source: Path) -> None:
        self.restored = source.read_bytes()


class FakeMedia:
    def __init__(self) -> None:
        self.images = {"items/a.jpg": StoredImage(b"image", "image/jpeg")}

    def list_keys(self) -> list[str]:
        return list(self.images)

    def get(self, key: str) -> StoredImage | None:
        return self.images.get(key)

    def put(self, key: str, content: bytes, content_type: str) -> None:
        self.images[key] = StoredImage(content, content_type)


def rewrite_zip(source: Path, destination: Path, mutate) -> None:
    with zipfile.ZipFile(source) as original, zipfile.ZipFile(destination, "w") as changed:
        for name in original.namelist():
            changed.writestr(name, mutate(name, original.read(name)))


def test_create_verify_and_restore_complete_artifact(tmp_path: Path) -> None:
    database = FakeDatabase()
    source_media = FakeMedia()
    artifact = create_artifact(
        tmp_path,
        database,
        source_media,
        "0013_workspace_model",
        "0.0.1",
        [{"id": "workspace-a", "type": "household"}],
    )

    verified = verify_artifact(artifact)
    target_media = FakeMedia()
    target_media.images.clear()
    restored = BackupService.restore(
        artifact, database, target_media, "0013_workspace_model", confirmed=True
    )

    assert verified.backup_id == restored.backup_id
    assert verified.media_count == 1
    assert verified.workspaces == (("workspace-a", "household"),)
    assert database.restored == b"consistent postgres snapshot"
    assert target_media.images["items/a.jpg"].content == b"image"
    with zipfile.ZipFile(artifact) as archive:
        manifest = json.loads(archive.read("manifest.json"))
        assert manifest["format_version"] == 1
        assert manifest["scope"] == "full-instance"
        assert manifest["workspaces"] == [{"id": "workspace-a", "type": "household"}]
        assert manifest["excluded"] == [
            "user_sessions",
            "pairing_sessions",
            "devices",
            "runtime_secrets",
        ]


def test_restore_requires_confirmation_and_matching_schema(tmp_path: Path) -> None:
    artifact = create_artifact(tmp_path, FakeDatabase(), FakeMedia(), "0012", "0.0.1")
    with pytest.raises(RestoreSafetyError, match="confirmation"):
        BackupService.restore(artifact, FakeDatabase(), FakeMedia(), "0012", confirmed=False)
    with pytest.raises(RestoreSafetyError, match="incompatible"):
        BackupService.restore(artifact, FakeDatabase(), FakeMedia(), "future", confirmed=True)


@pytest.mark.parametrize("target", ["database/postgres.dump", "media/items/a.jpg", "manifest.json"])
def test_verification_rejects_changed_content(tmp_path: Path, target: str) -> None:
    artifact = create_artifact(tmp_path, FakeDatabase(), FakeMedia(), "0012", "0.0.1")
    corrupt = tmp_path / f"corrupt-{Path(target).name}.whbackup"
    rewrite_zip(
        artifact, corrupt, lambda name, content: content + b"changed" if name == target else content
    )
    with pytest.raises(BackupIntegrityError):
        verify_artifact(corrupt)


def test_verification_rejects_missing_file_and_truncated_archive(tmp_path: Path) -> None:
    artifact = create_artifact(tmp_path, FakeDatabase(), FakeMedia(), "0012", "0.0.1")
    missing = tmp_path / "missing.whbackup"
    with zipfile.ZipFile(artifact) as original, zipfile.ZipFile(missing, "w") as changed:
        for name in original.namelist():
            if name != "database/postgres.dump":
                changed.writestr(name, original.read(name))
    with pytest.raises(BackupIntegrityError):
        verify_artifact(missing)
    truncated = tmp_path / "truncated.whbackup"
    truncated.write_bytes(artifact.read_bytes()[:50])
    with pytest.raises(BackupIntegrityError):
        verify_artifact(truncated)


def test_verification_rejects_future_version(tmp_path: Path) -> None:
    artifact = create_artifact(tmp_path, FakeDatabase(), FakeMedia(), "0012", "0.0.1")
    future = tmp_path / "future.whbackup"

    def mutate(name: str, content: bytes) -> bytes:
        if name == "manifest.json":
            value = json.loads(content)
            value["format_version"] = 2
            return json.dumps(value).encode()
        return content

    rewrite_zip(artifact, future, mutate)
    with pytest.raises(BackupCompatibilityError):
        verify_artifact(future)


def test_missing_media_fails_creation_without_final_artifact(tmp_path: Path) -> None:
    media = FakeMedia()
    media.get = lambda _key: None  # type: ignore[method-assign]
    with pytest.raises(BackupIntegrityError, match="disappeared"):
        create_artifact(tmp_path, FakeDatabase(), media, "0012", "0.0.1")
    assert not list(tmp_path.glob("*.whbackup"))


def test_database_failure_leaves_no_artifact(tmp_path: Path) -> None:
    class FailedDatabase(FakeDatabase):
        def create_snapshot(self, destination: Path) -> None:
            raise RuntimeError("pg_dump failed")

    with pytest.raises(RuntimeError, match="pg_dump failed"):
        create_artifact(tmp_path, FailedDatabase(), FakeMedia(), "0012", "0.0.1")
    assert not list(tmp_path.iterdir())
