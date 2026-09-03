# ADR-0009: Portable backup artifacts behind storage providers

- Status: Accepted
- Date: 2026-09-02

## Context

WhereHouse must recover PostgreSQL and intended media on local/Pi installations and may copy the
same backup to remote owner-controlled storage. Live database files are unsafe in consumer sync
folders, and provider-specific restore code would make recovery dependent on a vendor.

## Decision

WhereHouse creates a provider-neutral, full-instance `.whbackup` ZIP artifact before storage. Format
version 1 contains a PostgreSQL custom-format dump, canonical database-referenced media, a manifest,
and a SHA-256 checksum index. The application backup capability verifies an artifact both before
storage and after retrieval. Restore always uses the same verified local-artifact path.

`BackupProvider` owns only `store`, `list`, `retrieve`, and `delete`. Retention selection belongs to
the application service. The MVP adapters are a configurable filesystem/mounted-volume adapter and
a Dropbox App Folder adapter. Another remote provider implements that port without changing the
archive or restore orchestration.

Clients consume an instance-scoped provider-neutral health contract and never call Dropbox. Web owns
remote OAuth and manual-run management; mobile provides status visibility only. Local filesystem
configuration remains CLI-only. OAuth uses authorization code plus PKCE and stores the refresh token
in a mode-0600 server credential file, outside the database and backup artifact.

Restore version 1 supports an empty database and empty media destination only, requires the exact
backup ID as confirmation, rejects a mismatched Alembic revision, and restores the database in one
PostgreSQL transaction before writing already-verified staged media. A failed media write after the
database transaction requires discarding and recreating the clean target before retrying; the
implementation does not claim an atomic database/media switch.

Session, pairing-session, and device rows are schema-only in the dump: their credential-bearing data
is excluded. Runtime environment values, signing material, provider credentials, and API keys never
enter the artifact. Users sign in again and mobile devices re-pair after restore.

Format version 1 is unencrypted. Encryption is deliberately provider-neutral: a future envelope
must wrap the completed verified artifact before `BackupProvider.store`, and be decrypted before the
ordinary verifier. No encrypted-backup support is claimed until an established format/library, key
management, recovery UX, and wrong-passphrase testing land.

## Consequences

- PostgreSQL client tools are runtime prerequisites; live PostgreSQL directories are never copied.
- Local destinations must already exist, preventing an absent external mount from silently writing
  to a similarly named local directory.
- Operators must quiesce application writes while creating a backup so the transactionally
  consistent database dump and subsequently read media form one operational point in time.
- SHA-256 detects corruption and incompleteness, not malicious tampering; artifacts remain sensitive
  household data and need access-controlled storage until encryption is implemented.
