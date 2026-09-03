import stat
from pathlib import Path

import pytest

from app.application.backups.errors import BackupProviderError
from app.infrastructure.backups.local_config import LocalDestinationStore


def test_local_destination_configuration_and_health(tmp_path: Path) -> None:
    destination = tmp_path / "mounted-storage"
    destination.mkdir()
    store = LocalDestinationStore(tmp_path / "private" / "local.json")

    configured = store.save(destination, "Backup SSD")

    assert configured.path == destination.resolve()
    assert configured.label == "Backup SSD"
    assert store.load() == configured
    assert LocalDestinationStore.validate(configured.path) > 0
    assert stat.S_IMODE(store.path.stat().st_mode) == 0o600


def test_local_destination_must_exist_and_be_mounted(tmp_path: Path) -> None:
    store = LocalDestinationStore(tmp_path / "local.json")
    with pytest.raises(BackupProviderError, match="missing or not mounted"):
        store.save(tmp_path / "missing", "Backup SSD")
    assert store.load() is None


def test_local_destination_requires_friendly_label(tmp_path: Path) -> None:
    destination = tmp_path / "storage"
    destination.mkdir()
    with pytest.raises(BackupProviderError, match="label"):
        LocalDestinationStore(tmp_path / "local.json").save(destination, " ")
