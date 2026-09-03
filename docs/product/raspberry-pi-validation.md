# Raspberry Pi appliance validation

Record date, commit, image/checksum, Pi model/RAM, boot medium, image version, operator, commands,
timings, and observed result for every row. Automated evidence never completes a physical row. As of
2026-09-03, all physical rows below are **not run**.

## Fresh install (repeat on Pi 4 and Pi 5)

- [ ] Verify SHA-256; flash the model-specific `.img.xz` with Raspberry Pi Imager.
- [ ] Boot SD, discover `wherehouse.local`, and complete readiness, account, and household setup with
  no shell intervention.
- [ ] Pair mobile; create locations/item/photo; search, scan, move, and archive.
- [ ] Confirm no fixed OS/app/database/device/pairing credentials exist in the release image.

## Persistence and lifecycle

- [ ] Restart the service and reboot; confirm automatic recovery, unchanged UUID/secrets, persistence,
  and clean PostgreSQL shutdown evidence.
- [ ] Perform a controlled physical power-cycle and record observed recovery (not a guarantee).
- [ ] Crash/restart an application container and confirm normal restart-policy recovery.

## Storage, backup, and restore

- [ ] Boot and operate from supported USB SSD media.
- [ ] Test generic external storage: read/write, removal, missing-at-boot, reconnect, permissions,
  low-space, and full-space behavior.
- [ ] Create/verify local, external, and (when credentials exist) Dropbox `.whbackup` artifacts.
- [ ] Restore cleanly and verify workspaces, hierarchy, items, quantities, placements, identifiers,
  and intended media.

## Upgrade and failures

- [ ] Upgrade from the oldest supported release; verify backup, migration, health, reported version,
  web/mobile compatibility, persistence, and recorded success.
- [ ] Inject failed health/migration; verify container recovery where schema-compatible and clean
  restore where it is not.
- [ ] Exercise delayed/unavailable PostgreSQL, unavailable/full storage, corrupt backup, unavailable
  network/mDNS, and unavailable Dropbox; confirm visible diagnostics and no state recreation.
