from __future__ import annotations

import json
import os
from pathlib import Path

from app.application.backups.errors import BackupProviderError


class DropboxCredentialStore:
    def __init__(self, path: str | Path) -> None:
        self.path = Path(path).expanduser().resolve()

    def load(self) -> str | None:
        if not self.path.is_file():
            return None
        try:
            value = json.loads(self.path.read_text()).get("refresh_token")
        except (OSError, json.JSONDecodeError) as error:
            raise BackupProviderError("Dropbox credential store could not be read") from error
        return value if isinstance(value, str) and value else None

    def save(self, refresh_token: str) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_suffix(".incomplete")
        try:
            descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(descriptor, "w") as handle:
                json.dump({"refresh_token": refresh_token}, handle)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, self.path)
        except OSError as error:
            raise BackupProviderError("Dropbox credential store could not be written") from error
        finally:
            temporary.unlink(missing_ok=True)

    def delete(self) -> None:
        self.path.unlink(missing_ok=True)
