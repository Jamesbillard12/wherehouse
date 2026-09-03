from __future__ import annotations

import hashlib
import json
import os
import shutil
import tempfile
import zipfile
from datetime import UTC, datetime
from pathlib import Path, PurePosixPath
from typing import Any
from uuid import uuid4

from app.application.backups.errors import BackupCompatibilityError, BackupIntegrityError
from app.application.backups.models import ARTIFACT_SUFFIX, BACKUP_FORMAT_VERSION, VerifiedBackup
from app.application.backups.ports import DatabaseBackup, MediaRepository

MANIFEST_NAME = "manifest.json"
CHECKSUMS_NAME = "checksums.json"
DATABASE_NAME = "database/postgres.dump"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _safe_member(name: str) -> bool:
    path = PurePosixPath(name)
    return bool(name) and not path.is_absolute() and ".." not in path.parts


def create_artifact(
    destination_dir: Path,
    database: DatabaseBackup,
    media: MediaRepository,
    schema_revision: str,
    app_version: str,
) -> Path:
    destination_dir.mkdir(parents=True, exist_ok=True)
    backup_id = str(uuid4())
    created_at = datetime.now(UTC)
    name = f"wherehouse-{created_at:%Y%m%dT%H%M%SZ}-{backup_id[:8]}{ARTIFACT_SUFFIX}"
    final_path = destination_dir / name
    temporary_path = destination_dir / f".{name}.incomplete"

    with tempfile.TemporaryDirectory(prefix="wherehouse-backup-") as raw_workspace:
        workspace = Path(raw_workspace)
        database_path = workspace / DATABASE_NAME
        database_path.parent.mkdir(parents=True)
        database.create_snapshot(database_path)

        media_entries: list[dict[str, Any]] = []
        for key in media.list_keys():
            if not _safe_member(key):
                raise BackupIntegrityError(f"Unsafe media key: {key}")
            stored = media.get(key)
            if stored is None:
                raise BackupIntegrityError(f"Referenced media disappeared during backup: {key}")
            media_path = workspace / "media" / key
            media_path.parent.mkdir(parents=True, exist_ok=True)
            media_path.write_bytes(stored.content)
            media_entries.append({"key": key, "content_type": stored.content_type})

        manifest = {
            "format": "wherehouse-portable-backup",
            "format_version": BACKUP_FORMAT_VERSION,
            "backup_id": backup_id,
            "created_at": created_at.isoformat(),
            "application_version": app_version,
            "schema_revision": schema_revision,
            "scope": "full-instance",
            "database": {"path": DATABASE_NAME, "format": "postgresql-custom"},
            "media": media_entries,
            "excluded": ["user_sessions", "pairing_sessions", "devices", "runtime_secrets"],
            "encryption": {"enabled": False},
        }
        manifest_path = workspace / MANIFEST_NAME
        manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")

        content_paths = [database_path, manifest_path]
        content_paths.extend(workspace / "media" / item["key"] for item in media_entries)
        checksums = {
            path.relative_to(workspace).as_posix(): f"sha256:{sha256_file(path)}"
            for path in content_paths
        }
        (workspace / CHECKSUMS_NAME).write_text(
            json.dumps({"algorithm": "sha256", "files": checksums}, indent=2, sort_keys=True) + "\n"
        )

        try:
            with zipfile.ZipFile(temporary_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
                for path in sorted(workspace.rglob("*")):
                    if path.is_file():
                        archive.write(path, path.relative_to(workspace).as_posix())
            os.replace(temporary_path, final_path)
        finally:
            temporary_path.unlink(missing_ok=True)
    return final_path


def verify_artifact(artifact: Path) -> VerifiedBackup:
    if not artifact.is_file():
        raise BackupIntegrityError(f"Backup artifact does not exist: {artifact}")
    try:
        with zipfile.ZipFile(artifact) as archive:
            names = archive.namelist()
            if any(not _safe_member(name) for name in names):
                raise BackupIntegrityError("Backup contains an unsafe path")
            if len(names) != len(set(names)):
                raise BackupIntegrityError("Backup contains duplicate paths")
            required = {MANIFEST_NAME, CHECKSUMS_NAME, DATABASE_NAME}
            if not required.issubset(names):
                raise BackupIntegrityError("Backup is missing required files")
            manifest = json.loads(archive.read(MANIFEST_NAME))
            checksums = json.loads(archive.read(CHECKSUMS_NAME))
            if manifest.get("format") != "wherehouse-portable-backup":
                raise BackupCompatibilityError("Not a WhereHouse backup")
            version = manifest.get("format_version")
            if version != BACKUP_FORMAT_VERSION:
                raise BackupCompatibilityError(
                    f"Unsupported backup format version {version}; supported: {BACKUP_FORMAT_VERSION}"
                )
            if checksums.get("algorithm") != "sha256":
                raise BackupCompatibilityError("Unsupported checksum algorithm")
            expected_files = checksums.get("files")
            if not isinstance(expected_files, dict):
                raise BackupIntegrityError("Malformed checksum index")
            for name, expected in expected_files.items():
                if (
                    name not in names
                    or not isinstance(expected, str)
                    or not expected.startswith("sha256:")
                ):
                    raise BackupIntegrityError(f"Missing or malformed checksum entry: {name}")
                actual = hashlib.sha256(archive.read(name)).hexdigest()
                if actual != expected.removeprefix("sha256:"):
                    raise BackupIntegrityError(f"Checksum mismatch: {name}")
            declared = {DATABASE_NAME, MANIFEST_NAME}
            declared.update(f"media/{item['key']}" for item in manifest.get("media", []))
            if set(expected_files) != declared:
                raise BackupIntegrityError("Manifest and checksum index disagree")
            if set(names) != declared | {CHECKSUMS_NAME}:
                raise BackupIntegrityError("Backup contains undeclared files")
            created_at = datetime.fromisoformat(manifest["created_at"])
            return VerifiedBackup(
                artifact=artifact,
                backup_id=manifest["backup_id"],
                created_at=created_at,
                schema_revision=manifest["schema_revision"],
                media_count=len(manifest.get("media", [])),
                encrypted=bool(manifest.get("encryption", {}).get("enabled")),
            )
    except (zipfile.BadZipFile, json.JSONDecodeError, KeyError, ValueError, TypeError) as error:
        raise BackupIntegrityError(f"Malformed backup artifact: {error}") from error


def extract_verified(artifact: Path, destination: Path) -> dict[str, Any]:
    verify_artifact(artifact)
    destination.mkdir(parents=True, exist_ok=False)
    with zipfile.ZipFile(artifact) as archive:
        for member in archive.infolist():
            if not _safe_member(member.filename):
                raise BackupIntegrityError("Backup contains an unsafe path")
            target = destination / member.filename
            target.parent.mkdir(parents=True, exist_ok=True)
            if not member.is_dir():
                with archive.open(member) as source, target.open("wb") as output:
                    shutil.copyfileobj(source, output)
    return json.loads((destination / MANIFEST_NAME).read_text())
