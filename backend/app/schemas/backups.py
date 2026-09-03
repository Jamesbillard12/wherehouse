from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class BackupDestinationStatusRead(BaseModel):
    kind: Literal["local", "remote"]
    provider: str
    display_name: str
    state: Literal["not_configured", "connected", "needs_attention", "unavailable"]
    configured: bool
    needs_attention: bool
    last_successful_backup_at: datetime | None
    management: Literal["web", "cli"]
    message: str | None


class BackupStatusRead(BaseModel):
    scope: Literal["instance"]
    overall: Literal["protected", "backup_due", "needs_attention", "no_backup_configured"]
    destinations: list[BackupDestinationStatusRead]
