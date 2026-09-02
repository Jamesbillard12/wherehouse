# MVP release checklist

Record evidence (test/run/device/commit), not only a checkmark. Use **implementation**, **physical
validation**, and **release validation** separately. Unsupported items must be reconciled with
[MVP scope](mvp.md), not silently skipped.

## Account and household

Phase 5 automated implementation evidence is recorded in [account and household validation](account-household-validation.md).
Keep these rows unchecked until the documented manual/physical runs are recorded.

- [ ] Registration, login, valid-session restoration, logout
- [ ] Household creation, switching, isolation, and basic settings
- [ ] Mobile pairing, physical pairing, forget/re-pair, server-side revoke where supported
- [ ] Expired/revoked credential and useful error states
- [ ] Active web revoke automatically disconnects only the targeted mobile through realtime
- [ ] Background/offline revoke is detected on reconnect and queued work remains retained but blocked

## Web

- [ ] Area, zone, container create/edit; nesting and cycle rejection; contents and capacity state
- [ ] Item create/edit/archive, quantity, metadata, image, placement, movement
- [ ] Search and accurate human-readable resolved location
- [ ] QR generation/display/printing; identifier details and adverse states
- [ ] Destructive confirmation, loading/empty/error behavior

## Mobile

- [ ] Pairing, initial sync, household switching, location/item browsing and search
- [ ] Add/edit/move item; camera and library; quantity; recent/location selection; add-another
- [ ] Scan container/item; QR; NFC read/write/read-back verification; empty NFC registration
- [ ] Offline browsing and every documented queued write; replay/reconnect; forget/re-pair

## Phase 2 search validation sequence

Use the fixture and record the automated, realistic-volume, simulator/emulator, and physical-device
evidence described in [search validation](search-validation.md). Connected clients must use canonical
household-scoped server results; mobile offline search is explicitly a cached fallback. Do not mark
the web or mobile search rows complete until mutation, archive, error, and resolved-path behavior has
been exercised in the relevant client.

## Phase 1 inventory validation sequence

Run this once in web and once on a mobile simulator/emulator, then repeat the photo steps on a
physical iOS and Android device before claiming physical validation:

1. Create `Garage`, `North Wall`, `Shelf`, and child container `Yellow Bin`.
2. Reject placing `Shelf` below `Yellow Bin` and verify the hierarchy remains unchanged.
3. Create `Camping Stove` with quantity, metadata, photo, and initial placement in `Yellow Bin`.
4. Verify both clients display `Garage > North Wall > Shelf > Yellow Bin` from canonical API state.
5. Edit the item and move it to another valid location; verify both clients converge without reload
   or database intervention.
6. Replace the photo, then archive the item through the destructive confirmation and verify it leaves
   active lists on both clients.

Automated backend, web, type, and lint checks are implementation evidence only. Record simulator or
emulator results separately from physical-device camera/library and cross-client realtime evidence.

## Offline and realtime

Use the exact supported/unsupported scope and evidence fields in [Phase 4 offline sync
validation](offline-sync-validation.md). Automated policy, capability, type, and lint checks are
implementation evidence; they do not complete physical restart or cross-client rows.

- [ ] Disconnect before and during mutation; queue persists through app restart
- [ ] Reconnect and retry execute the operation once with no duplicate/loss
- [ ] Web and a second client update; realtime disconnect/reconnect converges
- [ ] Supported conflict behavior and operation/schema version compatibility are documented/tested

## Physical hardware

Use the evidence fields and adverse-case sequence in [physical identifier
validation](physical-identifier-validation.md). The current implementation is ready for this exercise;
none of the following physical rows is complete from automated evidence alone.

### iOS

- [ ] Camera, QR scan, NFC read, NFC write, NFC read-back verification, physical pairing
- [ ] Supported OS/device and limitations recorded

### Android

- [ ] Camera, QR scan, NFC read, NFC write, NFC read-back verification, physical pairing
- [ ] Supported OS/device and limitations recorded

## Deployment and operation

- [ ] Clean supported installation; database setup; migrations; storage permissions
- [ ] Start/status/restart; machine reboot and automatic recovery
- [ ] Upgrade/migration exercise and rollback/recovery guidance
- [ ] Disk-space failure/monitoring behavior; external-storage guidance
- [ ] Clean supported Raspberry Pi install and realistic-volume smoke test

## Backup and restore

Use [Phase 6 backup and restore validation](backup-restore-validation.md). Automated adapter and
artifact tests are implementation evidence only; keep these rows unchecked until the documented
real PostgreSQL, mounted-volume, and Dropbox drills are recorded.

- [ ] Consistent backup includes database and intended media; exclusions/secrets documented
- [ ] Manifest, application/schema version, checksums and integrity validation
- [ ] Configurable local/external-volume store, list, retrieve, prune, delete and failure behavior
- [ ] Dropbox refresh-token auth, upload/list/download/delete, failures and provider-neutral retention
- [ ] Web Dropbox connect/reauthorize/disconnect/manual-run/status and visible failure recovery
- [ ] Mobile instance-scoped Dropbox connection/health/last-success display updates after re-pair
- [ ] Restore into clean/test environment; household/user scope behaves as intended
- [ ] Items, quantities, hierarchy, identifiers and images verified
- [ ] Corrupt, partial, failed and incompatible-version behavior; retention/encryption if configured

## Future-readiness gate

- [ ] New important rules are not REST-route-only; representative operations use capabilities
- [ ] `MoveItem` and other capabilities, actor context and repository ports remain transport-neutral
- [ ] Authorization can evolve toward scopes without enterprise RBAC now
- [ ] Stable/versioned operation IDs and reusable idempotency cover supported retries
- [ ] Confirmation evidence is not conceptually limited to a UI modal
- [ ] Transactions/events move with capabilities; realtime is not presented as audit
- [ ] Stable resource IDs and media-neutral physical identifiers are preserved
- [ ] Backup orchestration is provider-neutral; provider/storage details stay out of domain logic
- [ ] No AI provider is required or embedded in domain/application code; deterministic UI is complete
- [ ] MCP, assistants, automation and controlled generative UI can call capabilities later
- [ ] Authored UI remains complete; no arbitrary runtime-generated React/React Native
- [ ] Area/Zone/Container migration path and explicit contract versioning are preserved
- [ ] OpenAPI client generation or automated contract parity is established before external clients
- [ ] No speculative microservices, workflow engine, broker, or empty future abstraction was added
- [ ] Minimal audit persistence timing is decided; it lands before external automated writes

## Primary acceptance and sign-off

- [ ] Run the complete [primary acceptance workflow](mvp.md#primary-acceptance-workflow)
- [ ] Every [MVP release blocker](mvp-execution-plan.md#mvp-release-blockers) is cleared
- [ ] Release notes accurately distinguish supported, limited, and deferred behavior
- [ ] Documentation links, setup steps, tests/type checks/lint, migrations, and `git diff --check` pass
