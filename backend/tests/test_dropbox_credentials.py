import stat
from pathlib import Path

from app.infrastructure.backups.dropbox_credentials import DropboxCredentialStore


def test_credential_store_round_trip_and_disconnect(tmp_path: Path) -> None:
    path = tmp_path / "private" / "dropbox.json"
    store = DropboxCredentialStore(path)
    assert store.load() is None

    store.save("refresh-secret")

    assert store.load() == "refresh-secret"
    assert stat.S_IMODE(path.stat().st_mode) == 0o600
    store.delete()
    assert store.load() is None
