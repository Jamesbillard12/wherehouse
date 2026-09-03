from datetime import UTC, datetime

from app.application.backups.errors import BackupProviderError
from app.application.backups.models import StoredBackup
from app.application.backups.status import destination_status, summarize


class Provider:
    def __init__(self, items=None, error: Exception | None = None) -> None:
        self.items = items or []
        self.error = error

    def list(self):
        if self.error:
            raise self.error
        return self.items


def test_provider_neutral_status_and_summary() -> None:
    last = datetime(2026, 9, 2, 21, 14, tzinfo=UTC)
    remote = destination_status(
        kind="remote",
        provider_name="dropbox",
        display_name="Dropbox",
        management="web",
        configured=True,
        provider=Provider([StoredBackup("one.whbackup", 10, last)]),
    )
    local = destination_status(
        kind="local",
        provider_name="local",
        display_name="External storage",
        management="cli",
        configured=False,
        provider=None,
    )
    status = summarize([remote, local])
    assert status.scope == "instance"
    assert status.overall == "protected"
    assert remote.state == "connected"
    assert remote.last_successful_backup_at == last
    assert "path" not in remote.public_dict()


def test_authorization_failure_needs_attention() -> None:
    remote = destination_status(
        kind="remote",
        provider_name="dropbox",
        display_name="Dropbox",
        management="web",
        configured=True,
        provider=Provider(error=BackupProviderError("token rejected")),
    )
    assert remote.state == "needs_attention"
    assert remote.needs_attention is True
    assert "token rejected" not in (remote.message or "")
    assert summarize([remote]).overall == "needs_attention"


def test_configured_destination_without_backup_is_due() -> None:
    remote = destination_status(
        kind="remote",
        provider_name="future-provider",
        display_name="Future Provider",
        management="web",
        configured=True,
        provider=Provider(),
    )
    assert remote.state == "connected"
    assert summarize([remote]).overall == "backup_due"
