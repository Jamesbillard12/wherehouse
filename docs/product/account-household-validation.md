# Phase 5 account, household, and device validation

Phase 5 implementation is ready for manual and physical validation. Automated coverage proves the
device-targeted realtime contract, post-commit publication, idempotent revocation, owner checks,
household creation ownership/rollback, stale-event filtering, queue pause policy, web session
restore failure, and current regression suites. It does not prove delivery on suspended physical
iOS/Android apps or a complete release workflow.

## Revocation and queued-work policy

Revoking a device invalidates its bearer credential for REST and future WebSocket authentication.
The process-local realtime hub sends `device.revoked` only to sockets authenticated by that device,
then closes them with an authorization code. Mobile verifies both the device ID and original pairing
household ID, quarantines the secure credential, clears protected in-memory UI, and shows a re-pair
recovery state. Other device connections are unaffected.

Any pending operations on that mobile installation are retained but marked as needing attention.
They are not automatically replayed after re-pairing, because the original revoked authorization is
part of their provenance. MVP has no user-approved queue migration workflow; users must review and
re-enter retained work. Nothing is silently uploaded or deleted.

If a device is backgrounded or offline when revoked, it may miss the transient event. Its next REST
request or WebSocket authentication is rejected and reaches the same recovery state. Cached data may
remain in household-scoped SQLite storage for offline preservation, but it is removed from the active
protected UI and cannot authorize synchronization.

## Manual scenarios

Record date, commit, server build, mobile device/simulator, OS, app build, and outcome for each run.

- [ ] First setup: register, restore session, create first household, enter it, pair mobile, access inventory.
- [ ] Two households: create A/B, add distinct data, switch A → B → A, restart, and verify cache/search/queue isolation.
- [ ] Two devices: pair A/B, revoke A on web, verify A disconnects promptly while B keeps syncing, and reject A's old token.
- [ ] Active revoke: keep A open on an item, revoke on web, verify automatic recovery UI and no further API/queue/realtime activity.
- [ ] Offline revoke: queue an item offline, revoke on web, reconnect, verify no replay and retained needs-attention work.
- [ ] Background revoke: background mobile, revoke, reopen, and verify reconnect/auth rejection reaches the same recovery UI.
- [ ] Forget and re-pair: forget locally, pair again, verify one active connection and a working new credential.
- [ ] Revoked re-pair: re-pair A, verify the old token remains invalid, the new socket works, and B remains connected.
- [ ] Expired web session: refresh a protected route and verify private UI does not flash before sign-in recovery.
- [ ] Logout: verify browser credential, selected-household state, protected realtime, and protected UI are cleared.

## Physical-device status

No physical iOS or Android evidence is recorded yet. In particular, active, background, and offline
revocation plus real QR pairing remain required before physical validation can be marked complete.
