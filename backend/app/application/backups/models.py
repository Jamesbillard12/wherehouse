from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

BACKUP_FORMAT_VERSION = 1
ARTIFACT_SUFFIX = ".whbackup"


@dataclass(frozen=True)
class StoredBackup:
    key: str
    size: int
    modified_at: datetime | None = None


@dataclass(frozen=True)
class VerifiedBackup:
    artifact: Path
    backup_id: str
    created_at: datetime
    schema_revision: str
    media_count: int
    encrypted: bool
    workspaces: tuple[tuple[str, str], ...]
