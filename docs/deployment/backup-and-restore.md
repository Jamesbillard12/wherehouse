# Backup and restore operations

WhereHouse provides an administrative CLI for a portable full-instance backup. Run commands from
`backend/` with the production environment loaded. PostgreSQL `pg_dump`, `pg_restore`, and `psql` are
required; the backend container includes PostgreSQL client tools.

Stop or quiesce API writes during `create` and keep the API stopped during restore. The PostgreSQL
dump is transactionally consistent; quiescing also keeps database media references stable while
canonical media is collected.

`BACKUP_STAGING_DIR` is a local working destination for finalized, verified artifacts and defaults to
`./backup-staging`. Provider storage follows verification. The local artifact remains if upload/copy
fails, and successful staging artifacts remain until the operator removes them under normal storage
policy; monitor this directory's disk use.

## Local disk or mounted external SSD

Create and mount the destination first, then save it with the server-side admin CLI. WhereHouse
intentionally does not create the destination: an absent or unmounted SSD therefore fails instead of
silently writing to the system disk.

```bash
python -m app.application.backups.cli configure-local /mnt/wherehouse-backups \
  --label "Backup SSD"
python -m app.application.backups.cli destinations
python -m app.application.backups.cli create --provider local
python -m app.application.backups.cli list --provider local
python -m app.application.backups.cli retrieve <key.whbackup> /safe/copy.whbackup --provider local
python -m app.application.backups.cli verify /safe/copy.whbackup
python -m app.application.backups.cli inspect /safe/copy.whbackup
python -m app.application.backups.cli prune --provider local --keep 7
python -m app.application.backups.cli delete <key.whbackup> --provider local
```

The configuration is stored in `BACKUP_LOCAL_CONFIG_FILE` (default
`./.data/local-backup-destination.json`) with mode `0600`. `BACKUP_LOCAL_DIR` remains a deployment
environment fallback when no saved configuration exists. The `destinations` command reports the raw
path, mount/write health, and available bytes to the server administrator; authenticated client status
receives only the friendly label and health state.

Writes use a hidden `.incomplete` sibling, check available bytes, flush/fsync, and atomically rename.
Missing mounts, insufficient space, permission errors, disconnect/write failures, and missing objects
fail without advertising an incomplete artifact.

## Dropbox App Folder

Create a Dropbox scoped-access app with **App folder** content access and file-content metadata scopes
needed to upload, list, download, and delete. Configure `DROPBOX_APP_KEY` and register
`DROPBOX_REDIRECT_URI` exactly with Dropbox. An owner then connects from web Backup & Restore using
OAuth authorization-code flow with PKCE. The refresh token is stored in the server-only
`DROPBOX_CREDENTIAL_FILE` with mode `0600`; it never enters client state, API responses, logs, or
backup artifacts. An optional `DROPBOX_APP_SECRET` remains a deployment secret. A pre-provisioned
`DROPBOX_REFRESH_TOKEN` is still supported for headless administration, but web disconnect cannot
remove an environment-owned secret. `DROPBOX_BACKUP_FOLDER` defaults to `/WhereHouse/Backups`.

Use the same commands with `--provider dropbox`. Each operation exchanges the refresh token for a
short-lived access token. Uploads at most 150 MiB use the single-call API; larger artifacts use an
8 MiB upload session. Retrieval is finalized locally only after the response completes, then the
same core verifier and restore flow used by local backups runs. Authorization, path, rate-limit,
quota, timeout/network, missing-object, and malformed-response failures become concise admin errors;
tokens are never logged.

The authenticated `GET /api/v1/backups/status` response is instance-scoped and reports Dropbox plus
friendly local/external-storage health without exposing absolute paths. Web can connect, reauthorize,
disconnect, and run Dropbox backup. Mobile presents status and last success only. Local destination
configuration and raw-path health remain CLI-only.

## Clean restore

Create a brand-new empty PostgreSQL database and an empty media destination, configure the new
WhereHouse environment, and keep its API stopped. Retrieve the artifact if needed, then:

```bash
python -m app.application.backups.cli verify /safe/backup.whbackup
python -m app.application.backups.cli inspect /safe/backup.whbackup
python -m app.application.backups.cli restore /safe/backup.whbackup --confirm <exact-backup-id>
```

Restore refuses non-empty targets, an incorrect confirmation ID, corrupt/incomplete archives,
unsupported format versions, and a schema revision different from the running code. Start the API
only after restore succeeds and validate household/login, hierarchy, items/quantities/placements,
identifiers, and every intended image. If database restore fails, its single transaction rolls back.
If a media write fails after database commit, discard/recreate both clean targets and retry.

Secrets and active session/device credentials are not restored. Re-enter environment secrets, sign
in again, re-pair mobile clients, resync their caches, and review old queued mutations. Version 1
does not support in-place restore, merges, older-schema migration during restore, or encryption.
Run a periodic clean-environment drill; successful creation or upload alone is not recovery evidence.
