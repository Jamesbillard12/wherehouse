from __future__ import annotations

import os
import subprocess
from pathlib import Path

from sqlalchemy.engine import make_url

from app.application.backups.errors import BackupError

EPHEMERAL_AUTH_TABLES = ("user_sessions", "pairing_sessions", "devices")


class PostgresBackup:
    def __init__(self, database_url: str) -> None:
        self.url = make_url(database_url.replace("+asyncpg", ""))

    def _connection_args(self) -> tuple[list[str], dict[str, str]]:
        args: list[str] = []
        if self.url.host:
            args.extend(["--host", self.url.host])
        if self.url.port:
            args.extend(["--port", str(self.url.port)])
        if self.url.username:
            args.extend(["--username", self.url.username])
        if self.url.database:
            args.extend(["--dbname", self.url.database])
        environment = os.environ.copy()
        if self.url.password:
            environment["PGPASSWORD"] = self.url.password
        return args, environment

    def _run(self, command: list[str]) -> None:
        connection, environment = self._connection_args()
        try:
            subprocess.run(
                [*command, *connection],
                check=True,
                capture_output=True,
                text=True,
                env=environment,
            )
        except FileNotFoundError as error:
            raise BackupError(f"Required PostgreSQL tool is not installed: {command[0]}") from error
        except subprocess.CalledProcessError as error:
            detail = (error.stderr or "PostgreSQL tool failed").strip().splitlines()[-1]
            raise BackupError(f"{command[0]} failed: {detail}") from error

    def create_snapshot(self, destination: Path) -> None:
        command = [
            "pg_dump",
            "--format=custom",
            "--no-owner",
            "--no-privileges",
            "--file",
            str(destination),
        ]
        for table in EPHEMERAL_AUTH_TABLES:
            command.append(f"--exclude-table-data={table}")
        self._run(command)

    def restore_snapshot(self, source: Path) -> None:
        self._assert_empty_database()
        self._run(
            [
                "pg_restore",
                "--exit-on-error",
                "--no-owner",
                "--no-privileges",
                "--single-transaction",
                str(source),
            ]
        )

    def _assert_empty_database(self) -> None:
        connection, environment = self._connection_args()
        try:
            result = subprocess.run(
                [
                    "psql",
                    *connection,
                    "--tuples-only",
                    "--no-align",
                    "--command",
                    "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'",
                ],
                check=True,
                capture_output=True,
                text=True,
                env=environment,
            )
        except (FileNotFoundError, subprocess.CalledProcessError) as error:
            raise BackupError("Could not verify that the restore database is empty") from error
        if result.stdout.strip() != "0":
            raise BackupError("Restore target is not empty; use a newly created database")
