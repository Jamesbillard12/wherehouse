# Phase 4 offline sync validation

This document defines the exact MVP offline contract and records implementation separately from
manual/device evidence. PostgreSQL remains canonical; SQLite is a household-scoped mobile cache and
pending-operation store, not another server.

## Supported mutation

| Operation | Version | Client and persistence | Idempotency | Conflict | Order/dependency |
| --- | --- | --- | --- | --- | --- |
| `item.create` | 1 | Stable draft/operation ID and household are written with optimistic item/placement cache rows in one SQLite transaction. Optional retained photo is part of the draft. | Every retry sends the same `client_operation_id`; the server's household-scoped unique constraint and payload hash return the existing item for an identical replay and reject changed payload. | Reusing an ID with different content is permanent and shown as needing attention. Invalid/missing/cross-household destinations are permanent. Unrelated remote changes do not conflict. | Sequential by `created_at`, then operation ID. Creation v1 has no queued-resource dependency; destinations must already be canonical cached resources. |

Success records the canonical item ID before optional photo upload, removes the operation and temporary
cache rows, and refetches server collections. If creation succeeded but the response or image upload
failed, replay uses the same operation ID and cannot create a second item. Images use the canonical
item's deterministic object key.

## Queue states and failures

The persisted states are `pending`, `in_progress`, `retryable_failed`, and `permanently_failed`.
Startup converts interrupted `in_progress` rows to retryable. Network errors/timeouts, 408, 425, 429,
and 5xx use exponential backoff capped at five minutes. A 401/403 pauses ordered replay and retains all
work for reauthentication/re-pairing. Other 4xx failures stop retrying that operation and remain visible
as locally saved items needing attention. Realtime events and replay responses are both treated as
invalidation: canonical refetch replaces temporary state, and duplicate events only trigger coalesced
reconciliation.

## Intentionally unsupported offline writes

Item edit, quantity change, movement, archive, identifier changes, item/container image updates outside
the creation draft, and all area/zone/container mutations require a successful online request. Mobile
does not enqueue or optimistically claim these writes. This is deliberate until mutable resources have
explicit preconditions and reusable idempotency; no last-write-wins or generic merge engine is implied.
Any update left by the pre-hardening queue is migrated to a visible needs-attention record and is not
silently replayed, overwritten, or discarded.

## Automated implementation evidence

- Mobile queue policy tests cover transient/auth/permanent classification, bounded backoff, and strict
  operation/draft version acceptance.
- Backend creation capability tests cover stored operation identity, identical replay without a second
  write/event, changed-payload conflict, and atomic initial placement.
- Type checks cover the mobile envelope/client boundary. Full SQLite/process-death and physical network
  behavior remains manual validation.

## Manual validation record

Record device/OS, server commit, mobile build, date, validator, and result for each scenario. Do not mark
the MVP release checklist complete from automated tests alone.

| Scenario | Required sequence | Evidence/result |
| --- | --- | --- |
| A Offline create/restart | Sync online; disconnect; create item with cached destination; confirm it appears locally; terminate app; restart offline; confirm item and pending count; reconnect; verify exactly one canonical item and temporary ID removal. | Not run |
| B Ambiguous timeout/duplicate | Cause the server to commit creation while the client times out; retry the same saved operation; verify one item row, one creation event, cleared queue, and canonical mobile row. | Not run |
| C Conflict/permanent failure | Queue against a destination, remove/archive it remotely, reconnect, and verify the operation remains locally visible as needing attention without repeated requests or overwrite. | Not run |
| D Household switch | Queue in household A; switch to B; verify no A item/status appears or replays; switch back to A and replay only with A context. | Not run |
| E Second client/realtime race | Keep mobile A offline, mutate unrelated state on web/B, reconnect A, and verify A creation plus unrelated changes converge on all clients; repeat an invalidation event and verify no duplicate rendering. | Not run |
| F Unsupported write UX | Disconnect and attempt edit, move/quantity, archive, and image-only update; verify failure is shown and none is described as saved/queued. | Not run |
| G Realistic queue | Queue 20 item creates with cached destinations, restart, reconnect, and verify ordered drain, matching local/server counts, no duplicate rows, bounded request rate, and web convergence. | Not run |
| H Revoked/expired device | Queue a create, revoke or expire the device, reconnect, verify replay pauses, work remains household-scoped locally, and authorization is not bypassed. | Not run |

Cached browsing is limited to data previously synced plus local pending creates. Images are available
offline only when their local file/cache exists. Internet reachability does not prove the self-hosted
backend is reachable; backend failures follow the same retry policy.
