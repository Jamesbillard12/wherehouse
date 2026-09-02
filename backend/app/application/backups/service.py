from __future__ import annotations

import json
import shutil
import tempfile
from pathlib import Path

from app.application.backups.artifact import DATABASE_NAME, extract_verified, verify_artifact
from app.application.backups.errors import RestoreSafetyError
from app.application.backups.models import StoredBackup, VerifiedBackup
from app.application.backups.ports import BackupProvider, DatabaseBackup, MediaRepository


class BackupService:
    def __init__(self, provider: BackupProvider) -> None:
        self.provider = provider

    def store(self, artifact: Path) -> StoredBackup:
        verify_artifact(artifact)
        return self.provider.store(artifact, artifact.name)

    def list(self) -> list[StoredBackup]:
        return self.provider.list()

    def retrieve(self, key: str, destination: Path) -> VerifiedBackup:
        artifact = self.provider.retrieve(key, destination)
        return verify_artifact(artifact)

    def delete(self, key: str) -> None:
        self.provider.delete(key)

    def prune(self, keep_last: int) -> list[str]:
        if keep_last < 1:
            raise ValueError("keep_last must be at least 1")
        backups = self.provider.list()
        deleted: list[str] = []
        for backup in backups[keep_last:]:
            self.provider.delete(backup.key)
            deleted.append(backup.key)
        return deleted

    @staticmethod
    def restore(
        artifact: Path,
        database: DatabaseBackup,
        media: MediaRepository,
        expected_schema_revision: str,
        confirmed: bool,
    ) -> VerifiedBackup:
        if not confirmed:
            raise RestoreSafetyError("Restore requires explicit confirmation")
        verified = verify_artifact(artifact)
        if verified.schema_revision != expected_schema_revision:
            raise RestoreSafetyError(
                f"Backup schema {verified.schema_revision} is incompatible with required schema {expected_schema_revision}"
            )
        with tempfile.TemporaryDirectory(prefix="wherehouse-restore-") as raw_workspace:
            workspace = Path(raw_workspace) / "contents"
            manifest = extract_verified(artifact, workspace)
            staged_media = Path(raw_workspace) / "media"
            source_media = workspace / "media"
            if source_media.exists():
                shutil.copytree(source_media, staged_media)
            database.restore_snapshot(workspace / DATABASE_NAME)
            for item in manifest.get("media", []):
                source = staged_media / item["key"]
                media.put(item["key"], source.read_bytes(), item["content_type"])
        return verified


def read_manifest(artifact: Path) -> dict:
    import zipfile

    verify_artifact(artifact)
    with zipfile.ZipFile(artifact) as archive:
        return json.loads(archive.read("manifest.json"))
