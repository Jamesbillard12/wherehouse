# Phase 6 backup and restore validation

Automated tests cover artifact creation/manifest/version/checksums, successful restore through fake
database/media ports, changed/missing/truncated/future artifacts, explicit confirmation and schema
compatibility, local-provider storage lifecycle and missing destinations, core retention, PostgreSQL
credential-table exclusions, and Dropbox request/auth mappings. These are implementation evidence,
not an actual PostgreSQL, external SSD, or Dropbox recovery drill.

Provider-neutral status tests cover connected, not-configured, backup-due, last-success, and
authorization-failure/needs-attention behavior. Web tests cover Dropbox connection states, last
success, management actions, and secret-free rendering. Mobile tests cover the same concise state
mapping; paired-server URL/token changes trigger a fresh status fetch.

## Manual local/external-volume round trip

- [ ] Record date, commit, host, PostgreSQL version, media backend, and destination/mount.
- [ ] Populate hundreds/low-thousands of items, representative hierarchy, quantities, placements,
  identifiers, users/memberships, and representative item/container images.
- [ ] Quiesce writes; create and verify; record duration, size, manifest, and checksum result.
- [ ] List, retrieve, and exercise keep-last retention without deleting incomplete/current artifacts.
- [ ] Restore into empty PostgreSQL and media targets; start the app and query/use every data class.
- [ ] Record missing mount, permission, low-space/disconnect where practical, corrupt media/database,
  missing member, invalid manifest, future version, wrong schema, and non-empty target failures.

## Manual Dropbox round trip

- [ ] Record date, commit, Dropbox app scope/auth method, test account/environment, and provider path
  without recording credentials.
- [ ] Create and verify locally; upload; list; download; verify; record size and timings.
- [ ] Restore the downloaded artifact through the ordinary core restore path into clean targets.
- [ ] Start the app and validate household/users, locations/zones/containers/nesting, items,
  quantities, placements, identifiers, and intended images.
- [ ] Exercise disconnected/revoked/expired authorization, timeout/interruption, quota, missing object,
  malformed response, and rate limiting where practical.
- [ ] Exercise provider-neutral retention and confirm the newest backups remain.
- [ ] Start disconnected; confirm web and mobile say not connected. Connect with web OAuth; confirm
  both say connected; run backup and confirm last success updates.
- [ ] Revoke authorization; confirm needs-attention/reconnect in web and mobile. Reauthorize through
  web and confirm both recover without exposing credentials.

## Current evidence (2026-09-02)

- Automated implementation: 88 backend tests passed on `feature/mvp-backup-restore`, including
  artifact/provider/PostgreSQL/Dropbox/status/credential tests; changed-code Ruff passed. Web 25/25
  and mobile 10/10 tests passed, and API-client/web/mobile TypeScript checks passed.
- Local/external SSD round trip: not yet run.
- Actual Dropbox round trip: not yet run; mocks are not counted.
- Clean PostgreSQL/application restore: not yet run.
- Environment limitation: the validation host had neither Docker nor PostgreSQL client executables,
  so it could not run a real database drill.
- Encryption: not implemented in format version 1; provider-neutral envelope design is documented.
