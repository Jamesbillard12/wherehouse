from pathlib import Path

from app.infrastructure.backups.postgres import PostgresBackup


def test_pg_dump_excludes_ephemeral_credentials(monkeypatch, tmp_path: Path) -> None:
    commands: list[list[str]] = []
    backup = PostgresBackup("postgresql+asyncpg://user:secret@db.example:5433/wherehouse")
    monkeypatch.setattr(backup, "_run", commands.append)
    backup.create_snapshot(tmp_path / "database.dump")
    command = commands[0]
    assert command[0] == "pg_dump"
    assert "--exclude-table-data=user_sessions" in command
    assert "--exclude-table-data=pairing_sessions" in command
    assert "--exclude-table-data=devices" in command
    assert "secret" not in " ".join(command)
