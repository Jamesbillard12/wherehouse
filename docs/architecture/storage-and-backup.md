# Storage and backup architecture

Backups remain deployment-wide, but the format is workspace-aware: each new manifest records every
workspace UUID and type. Provider credentials and destination paths stay instance configuration rather
than being duplicated per workspace. Clean restore preserves workspace IDs, types, memberships, and
scoped resources together.

Primary storage and backup destinations are different concerns. PostgreSQL is canonical application
data; item/container images use the configured local-filesystem or S3-compatible `ImageStorage`.
Backup destinations receive only finalized portable artifacts. Never place live PostgreSQL files,
WAL, SQLite databases, or mutable media directories in Dropbox or another consumer sync folder.

## Implemented boundary

`BackupService` depends on a four-operation `BackupProvider`: store, list, retrieve, and delete.
Provider-neutral retention lists newest-first and asks the provider to delete entries beyond the
configured keep count. The local adapter provides configurable local/external-volume storage with
free-space checking, incomplete-file cleanup, fsync, and atomic rename. The Dropbox adapter provides
refresh-token authentication, upload (including upload sessions over 150 MiB), pagination-aware
listing, download through an incomplete file, and deletion. Provider failures are translated to
administrative errors without logging credentials.

Local destination selection is persisted separately from the artifact format in a server-only JSON
file with mode `0600`. The admin CLI validates that the chosen directory is mounted and writable before
saving it and exposes a destination-health command for deployment operations. An environment path is
retained as a headless fallback. Neither the persisted raw path nor the fallback path enters the client
status contract.

Creation first finalizes and verifies an artifact in `BACKUP_STAGING_DIR`. Provider storage happens
afterward; a failed local copy or Dropbox upload leaves that valid local artifact available for retry.

The artifact and restore code contains no Dropbox conditionals. S3, B2, OneDrive, Google Drive,
WebDAV, or a NAS-specific provider can implement the same four operations without changing backup
creation, format, verification, retention, or restore.

Authenticated clients read one instance-scoped status contract. It reports provider kind/name,
configured state, health, last successful artifact timestamp, management surface, and a friendly
message; it never returns credentials or raw local paths. Web Settings is the remote-provider
management surface. Mobile shows concise remote health and directs reauthorization to web. Local
and mounted-volume paths remain CLI/admin configuration because they belong to the server.

## Portable artifact format version 1

`wherehouse-YYYYMMDDTHHMMSSZ-<backup-id-prefix>.whbackup` is a ZIP container with:

```text
manifest.json
checksums.json
database/postgres.dump
media/<canonical image key>...
```

The manifest records format/version, UUID backup ID, UTC creation time, WhereHouse package version,
Alembic revision, full-instance scope, workspace UUID/type entries, PostgreSQL custom dump metadata,
media keys/content types,
exclusions, and encryption status. `checksums.json` SHA-256 hashes the manifest, database dump, and
every declared media object. Verification rejects invalid/truncated ZIP data, missing, extra,
duplicate or unsafe paths, malformed metadata, unsupported versions/algorithms, and checksum or
manifest/index disagreement.

The dump includes households, users/memberships and password hashes, app instances, areas, zones,
containers, hierarchy, items, quantities, placements, physical identifiers, idempotency fields, and
the Alembic revision. Canonical item/container images are retrieved through `ImageStorage`, so local
and S3-backed primary media follow the same path. Unreferenced/orphan media is excluded.

Schema definitions for `user_sessions`, `pairing_sessions`, and `devices` remain in the dump but
their rows are excluded. Runtime caches, logs, temporary files, mobile SQLite/queues, generated build
output, environment configuration, database/JWT/OAuth/Dropbox/S3 secrets, tokens, pairing codes, and
device credentials are excluded. After restore, web users sign in again; mobile clients re-pair,
resync caches, and review old queued mutations rather than uploading them blindly.

## Restore safety and compatibility

Verification and exact backup-ID confirmation happen before mutation. Version 1 restores only when
the archive Alembic head exactly equals the running code and both the target PostgreSQL `public`
schema and media destination are empty. `pg_restore --single-transaction --exit-on-error` prevents a
partial database import. Media is verified and staged before database import, then written through
`ImageStorage`. If a destination media write fails after database commit, discard/recreate the clean
target and retry; cross-store atomic switching is not claimed. Older-schema migration and in-place or
merge restore are unsupported in version 1; future-format and schema mismatches fail before import.

Format version 1 is not encrypted. Encryption remains a provider-neutral envelope around the
completed artifact, before storage and after retrieval, but no support is claimed until key recovery,
wrong-passphrase, and corruption behavior are implemented with an established cryptographic library.
Until then, protect artifacts as sensitive household data using destination access controls.
