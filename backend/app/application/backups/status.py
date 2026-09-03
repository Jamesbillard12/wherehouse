from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Literal

from app.application.backups.errors import BackupProviderError
from app.application.backups.ports import BackupProvider

DestinationKind = Literal["local", "remote"]
DestinationState = Literal["not_configured", "connected", "needs_attention", "unavailable"]


@dataclass(frozen=True)
class BackupDestinationStatus:
    kind: DestinationKind
    provider: str
    display_name: str
    state: DestinationState
    configured: bool
    needs_attention: bool
    last_successful_backup_at: datetime | None
    management: Literal["web", "cli"]
    message: str | None = None

    def public_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class BackupStatus:
    scope: Literal["instance"]
    overall: Literal["protected", "backup_due", "needs_attention", "no_backup_configured"]
    destinations: list[BackupDestinationStatus]


def destination_status(
    *,
    kind: DestinationKind,
    provider_name: str,
    display_name: str,
    management: Literal["web", "cli"],
    configured: bool,
    provider: BackupProvider | None,
) -> BackupDestinationStatus:
    if not configured or provider is None:
        return BackupDestinationStatus(
            kind, provider_name, display_name, "not_configured", False, False, None, management
        )
    try:
        backups = provider.list()
    except BackupProviderError:
        return BackupDestinationStatus(
            kind,
            provider_name,
            display_name,
            "needs_attention",
            True,
            True,
            None,
            management,
            "The destination could not be reached or authorized.",
        )
    return BackupDestinationStatus(
        kind,
        provider_name,
        display_name,
        "connected",
        True,
        False,
        backups[0].modified_at if backups else None,
        management,
        None if backups else "Connected; no successful backup is available yet.",
    )


def summarize(destinations: list[BackupDestinationStatus]) -> BackupStatus:
    configured = [item for item in destinations if item.configured]
    if any(item.needs_attention for item in configured):
        overall = "needs_attention"
    elif any(item.last_successful_backup_at for item in configured):
        overall = "protected"
    elif configured:
        overall = "backup_due"
    else:
        overall = "no_backup_configured"
    return BackupStatus(scope="instance", overall=overall, destinations=destinations)
