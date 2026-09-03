from __future__ import annotations

import json
import os
import shutil
from dataclasses import dataclass
from pathlib import Path

from app.application.backups.errors import BackupProviderError


@dataclass(frozen=True)
class LocalDestinationConfig:
    path: Path
    label: str


class LocalDestinationStore:
    def __init__(self, path: str | Path) -> None:
        self.path = Path(path).expanduser().resolve()

    def load(self) -> LocalDestinationConfig | None:
        if not self.path.is_file():
            return None
        try:
            payload = json.loads(self.path.read_text())
            destination = Path(payload["path"]).expanduser().resolve()
            label = str(payload.get("label") or "External storage").strip()
        except (OSError, KeyError, TypeError, json.JSONDecodeError) as error:
            raise BackupProviderError(
                "Local backup destination configuration is invalid"
            ) from error
        return LocalDestinationConfig(destination, label)

    def save(self, destination: str | Path, label: str) -> LocalDestinationConfig:
        resolved = Path(destination).expanduser().resolve()
        display_label = label.strip()
        if not display_label:
            raise BackupProviderError("Local backup destination label is required")
        self.validate(resolved)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_suffix(".incomplete")
        try:
            descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(descriptor, "w") as handle:
                json.dump({"path": str(resolved), "label": display_label}, handle)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, self.path)
        except OSError as error:
            raise BackupProviderError(
                "Local backup destination configuration could not be saved"
            ) from error
        finally:
            temporary.unlink(missing_ok=True)
        return LocalDestinationConfig(resolved, display_label)

    @staticmethod
    def validate(destination: Path) -> int:
        if not destination.is_dir():
            raise BackupProviderError(
                f"Backup destination is missing or not mounted: {destination}"
            )
        if not os.access(destination, os.W_OK):
            raise BackupProviderError(f"Backup destination is not writable: {destination}")
        return shutil.disk_usage(destination).free
