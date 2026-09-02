from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
from importlib.metadata import version
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import select

from app.application.backups.artifact import create_artifact, verify_artifact
from app.application.backups.errors import BackupError
from app.application.backups.media import SelectedMediaRepository
from app.application.backups.service import BackupService, read_manifest
from app.core.config import get_settings
from app.db.session import AsyncSessionFactory
from app.infrastructure.backups import DropboxBackupProvider, LocalBackupProvider, PostgresBackup
from app.infrastructure.backups.dropbox_credentials import DropboxCredentialStore
from app.models.core import Container, Item
from app.services.image_storage import get_image_storage

logger = logging.getLogger("wherehouse.backup")


async def canonical_media_keys() -> list[str]:
    async with AsyncSessionFactory() as session:
        item_paths = (
            await session.scalars(select(Item.image_path).where(Item.image_path.is_not(None)))
        ).all()
        container_paths = (
            await session.scalars(
                select(Container.image_path).where(Container.image_path.is_not(None))
            )
        ).all()
    return sorted({path for path in [*item_paths, *container_paths] if path})


def schema_revision() -> str:
    config = Config(str(Path(__file__).parents[3] / "alembic.ini"))
    config.set_main_option("script_location", str(Path(__file__).parents[3] / "alembic"))
    heads = ScriptDirectory.from_config(config).get_heads()
    if len(heads) != 1:
        raise BackupError("Backup requires exactly one Alembic schema head")
    return heads[0]


def provider_from_settings(name: str):
    settings = get_settings()
    if name == "local":
        return LocalBackupProvider(settings.backup_local_dir)
    if name == "dropbox":
        refresh_token = DropboxCredentialStore(settings.dropbox_credential_file).load()
        return DropboxBackupProvider(
            app_key=settings.dropbox_app_key or "",
            app_secret=settings.dropbox_app_secret,
            refresh_token=refresh_token or settings.dropbox_refresh_token or "",
            folder=settings.dropbox_backup_folder,
        )
    raise BackupError(f"Unsupported backup provider: {name}")


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description="WhereHouse backup administration")
    commands = result.add_subparsers(dest="command", required=True)
    create = commands.add_parser("create", help="create, verify, and store a backup")
    create.add_argument("--provider", choices=("local", "dropbox"), default=None)
    verify = commands.add_parser("verify", help="verify an artifact without restoring it")
    verify.add_argument("artifact", type=Path)
    inspect = commands.add_parser("inspect", help="print a verified artifact manifest")
    inspect.add_argument("artifact", type=Path)
    list_command = commands.add_parser("list", help="list stored backups")
    list_command.add_argument("--provider", choices=("local", "dropbox"), default=None)
    retrieve = commands.add_parser("retrieve", help="retrieve and verify a stored backup")
    retrieve.add_argument("key")
    retrieve.add_argument("destination", type=Path)
    retrieve.add_argument("--provider", choices=("local", "dropbox"), default=None)
    delete = commands.add_parser("delete", help="delete a stored backup")
    delete.add_argument("key")
    delete.add_argument("--provider", choices=("local", "dropbox"), default=None)
    prune = commands.add_parser("prune", help="retain only the newest backups")
    prune.add_argument("--keep", type=int, default=None)
    prune.add_argument("--provider", choices=("local", "dropbox"), default=None)
    restore = commands.add_parser("restore", help="restore into an empty database")
    restore.add_argument("artifact", type=Path)
    restore.add_argument("--confirm", required=True, metavar="RESTORE_BACKUP_ID")
    return result


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    args = parser().parse_args(argv)
    settings = get_settings()
    try:
        if args.command == "verify":
            print(verify_artifact(args.artifact))
            return 0
        if args.command == "inspect":
            print(json.dumps(read_manifest(args.artifact), indent=2, sort_keys=True))
            return 0
        if args.command == "restore":
            verified = verify_artifact(args.artifact)
            if args.confirm != verified.backup_id:
                raise BackupError(f"Confirmation must exactly match backup ID {verified.backup_id}")
            storage = get_image_storage()
            if storage.list_keys():
                raise BackupError("Restore media destination is not empty; use a clean environment")
            media = SelectedMediaRepository(storage, [])
            logger.info("restore started backup_id=%s", verified.backup_id)
            restored = BackupService.restore(
                args.artifact,
                PostgresBackup(settings.database_url),
                media,
                schema_revision(),
                confirmed=True,
            )
            logger.info("restore completed backup_id=%s", restored.backup_id)
            return 0

        provider_name = args.provider or settings.backup_provider
        service = BackupService(provider_from_settings(provider_name))
        if args.command == "create":
            keys = asyncio.run(canonical_media_keys())
            media = SelectedMediaRepository(get_image_storage(), keys)
            logger.info("backup started provider=%s", provider_name)
            artifact = create_artifact(
                Path(settings.backup_staging_dir),
                PostgresBackup(settings.database_url),
                media,
                schema_revision(),
                version("wherehouse-api"),
            )
            verified = verify_artifact(artifact)
            stored = service.store(artifact)
            logger.info(
                "backup completed backup_id=%s provider=%s", verified.backup_id, provider_name
            )
            print(
                json.dumps(
                    {
                        "backup_id": verified.backup_id,
                        "local_artifact": str(artifact),
                        "key": stored.key,
                        "size": stored.size,
                    }
                )
            )
            return 0
        if args.command == "list":
            print(json.dumps([item.__dict__ for item in service.list()], default=str, indent=2))
        elif args.command == "retrieve":
            print(service.retrieve(args.key, args.destination))
        elif args.command == "delete":
            service.delete(args.key)
        elif args.command == "prune":
            print(json.dumps(service.prune(args.keep or settings.backup_retention_count)))
        return 0
    except (BackupError, ValueError, OSError) as error:
        logger.error("%s", error)
        return 1


if __name__ == "__main__":
    sys.exit(main())
