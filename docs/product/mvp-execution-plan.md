# MVP execution plan

This is the dependency-ordered plan from repository state to the first MVP tag. Statuses
mean: **Not started**, **In progress**, **Hardening**, **Blocked**, **Ready for validation**, or
**Complete**. “Implementation complete,” “physical validation complete,” and “release validated” are
separate claims. Unknown physical/operational results remain unvalidated, not implicitly passing.

## Current-state assessment

| Capability | Evidence-based status | Main gap |
| --- | --- | --- |
| Registration/login/session/logout | Ready for validation | Protected bootstrap and expired-session recovery are automated; full browser restart/logout validation remains |
| Household creation/switching/settings | Ready for validation | Atomic creation and household-scoped clients are implemented; manual rapid-switch and multi-device validation remain |
| Pairing and device forgetting | Ready for validation | One-time pairing, local forget, revoke recovery, and re-pair path are implemented; physical QR/re-pair validation remains |
| Realtime device revocation | Ready for validation | Post-commit targeted event/close and mobile credential quarantine are automated; active/background/offline physical validation remains |
| Area/zone/container CRUD and contents | Implemented but needs hardening | Complete workflow tests and error states |
| Nested containers/cycle prevention | Partially implemented | Model/route behavior exists; hierarchy validation needs comprehensive tests |
| Item create/edit/archive, quantity, metadata | Implemented but needs hardening | End-to-end web/mobile parity and realistic-volume testing |
| Item/container images | Implemented but needs hardening | Media lifecycle, backup, failure and client coverage |
| Placement/movement/resolved paths | Implemented but needs validation | Create/update placement is transactional; canonical paths now come from the application layer; full-client physical validation remains |
| Search | Ready for validation | Canonical server search, metadata/direct-location matching, resolved paths, and client UX are implemented; realistic-volume and physical mobile validation remain |
| QR generate/display/print/scan | Ready for physical validation | Opaque versioned generation, web label UI, print isolation, payload rejection, and scan deduplication are implemented; printer and physical iOS/Android evidence remain |
| NFC read/write/verify/empty registration | Ready for physical validation | Write/read-back-before-activation and blank-tag flow are implemented; native iOS/Android evidence remains |
| Identifier activation/revocation/resolve | Ready for validation | Capability-owned household checks, retry-safe transitions, target integrity, and adverse lifecycle tests are implemented; end-to-end physical validation remains |
| Offline browse/cache | Implemented but needs hardening | Cached startup is implemented; physical restart, stale image, and realistic failure validation remain |
| Queued offline writes | Implemented, needs validation | MVP scope is explicitly `item.create` v1; edits/moves/quantity/archive and other writes are online-only |
| Idempotent replay | Ready for validation | Stable persisted creation IDs, payload-conflict detection, uniqueness, retry classification, and restart recovery are implemented; timeout/race validation remains |
| Realtime reconciliation | Implemented but needs hardening | Disconnect/reconnect/second-client convergence tests |
| Backup and restore | Not implemented | No supported orchestration, format, verification, or restore exercise |
| Raspberry Pi deployment | Partially implemented | Docker instructions exist; clean Pi/reboot/update/storage validation is absent |
| Cloud deployment | Partially implemented | Guidance exists; not an MVP release substitute for supported local operation |
| Application capabilities/actor context | Partially implemented | Create/update/delete/move item, container nesting, and identifiers lead; typed frontend feature actions now remove quick-create navigation coupling, while other route-owned location CRUD remains |
| Confirmations | Partially implemented | Reusable client UI exists; portable evidence/policy boundary is incomplete |
| Audit attribution | Not implemented | Realtime is not audit; required before external automated writes, not necessarily tag |
| Categories/tags, checkout/return, history | Deferred from MVP | No substantial current implementation |

## Phase summary

| Phase | Status | Main gaps | Exit criteria met |
| --- | --- | --- | --- |
| 0 Scope and architecture alignment | Complete | No current implementation gap | Yes |
| 1 Core inventory hardening | Hardening | E2E parity, paths, hierarchy/error validation | No |
| 2 Search and findability | Ready for validation | Realistic-volume/Pi timing and physical mobile/offline validation remain | No |
| 3 Physical identifiers | Ready for validation | Printed-label and real iOS/Android QR/NFC evidence | No |
| 4 Offline and synchronization | Hardening | Mutation coverage, restart/conflicts, exactly-once scenarios | No |
| 5 Account, household, settings | Ready for validation | Manual/physical setup, switching, active/background/offline revoke, and multi-device evidence | No |
| 6 Backup and restore | Not started | Entire supported workflow | No |
| 7 Pi and operations | In progress | Clean install, reboot/update, storage/recovery | No |
| 8 Future-readiness gate | In progress | Capability coverage, portable confirmation/idempotency, audit decision | No |
| 9 Release candidate validation | Not started | Depends on all release gates | No |

## Phase 0: Scope and architecture alignment

- **Purpose/current state:** complete; the repository has one evidence-based MVP definition.
- **Scope/work:** reorganize docs, current-state matrix, phases, checklist, blockers, architecture and
  backup/Pi direction; correct links and stale claims.
- **Testing/docs:** link validation, documentation searches, lint/checks.
- **Dependencies/non-goals:** none; no major product work or speculative interfaces.
- **Exit criteria:** scope categories are explicit, status is evidence-based, canonical docs and next
  workstreams are clear, and links pass.
- **Risk/branch:** status can age; update this plan with each phase. Current branch:
  `docs/mvp-plan-and-architecture`.

## Phase 1: Core inventory workflow hardening

- **Purpose/current state:** turn broad web/mobile CRUD into a consistently usable household workflow.
  Item create/initial placement and edit/move are now atomic, resolved item paths are canonical, and
  container cycle checks are capability-owned; simulator and physical cross-client validation remains.
- **Scope/work:** items, quantities, images, areas/zones/containers, nesting/cycle safety, placement,
  movement, resolved paths, errors, and destructive confirmation; extract materially changed rules
  into capabilities rather than routes.
- **Testing/docs:** application rules plus adapter/integration tests for
  `create location -> nest -> add -> locate -> edit -> move -> archive`; document supported image and
  location semantics.
- **Dependencies/non-goals:** foundational for offline/search; no unified-location rewrite or history UI.
- **Exit criteria:** the complete workflow succeeds on web and mobile without developer intervention.
- **Risk/branch:** route-owned transactions may diverge. `feature/mvp-inventory-hardening`.

## Phase 2: Search and findability

- **Purpose/current state:** canonical household-scoped server search and web/mobile UX are implemented;
  realistic-volume and physical mobile/offline validation remain.
- **Scope/work:** partial name plus useful manufacturer/model/code and practical location context;
  resolved paths; empty/error states and realistic-volume performance.
- **Testing/docs:** automated query/household/path/client coverage plus the realistic-volume and
  web/mobile sequence in [search validation](search-validation.md).
- **Dependencies/non-goals:** stable item/location semantics; no semantic or AI search.
- **Exit criteria:** expected users can reliably locate known test objects from each supported client.
- **Risk/branch:** client-only filtering may not scale. `feature/mvp-search-and-findability`.

## Phase 3: Physical identifier reliability

- **Purpose/current state:** reusable lifecycle operations, household checks, QR scan deduplication,
  NFC read-back-before-activation, and automated adverse lifecycle coverage are implemented; physical
  validation is outstanding.
- **Scope/work:** generate/print/scan/resolve, activation/revocation, NFC read/write/read-back and empty-tag
  registration; unknown, revoked, malformed, and wrong-household behavior.
- **Testing/docs:** automated lifecycle tests plus the separate physical iOS and Android matrix in
  [physical identifier validation](physical-identifier-validation.md).
- **Dependencies/non-goals:** core resources stable; no new identifier media or hardware inventory system.
- **Exit criteria:** QR passes on supported devices and every claimed NFC path is physically validated
  on each supported platform, with limitations recorded.
- **Risk/branch:** Expo/native and hardware differences. `feature/mvp-physical-identifiers`.

## Phase 4: Offline and synchronization hardening

- **Purpose/current state:** `item.create` v1 is the explicit MVP offline mutation set. Its optimistic
  cache/queue write is transactional; operations persist identity, household, type/version, state,
  attempts/backoff, failure and canonical ID; server creation is idempotent. Manual restart,
  timeout-after-commit, reconnect and multi-client evidence remains.
- **Scope/work:** define supported offline mutations; stable/versioned operations; restart persistence,
  replay, reconnect, conflicts, realtime reconciliation, duplicate prevention.
- **Testing/docs:** queue-policy automation plus the disconnect/restart, duplicate timeout, reconnect,
  household isolation, realtime race and second-client scenarios in
  [Phase 4 validation](offline-sync-validation.md); creation idempotency remains capability-owned.
- **Dependencies/non-goals:** sufficiently stable phase-1 mutations; no generic workflow engine/broker.
- **Exit criteria:** each supported queued operation survives tested failures and executes exactly once
  where appropriate, with clients converging.
- **Risk/branch:** partial idempotency can imply false safety. `feature/mvp-offline-sync-hardening`.

## Phase 5: Account, household, and settings polish

- **Purpose/current state:** implementation is ready for validation. Session bootstrap/logout recovery,
  atomic household creation, switching/cache scoping, pairing/forget/re-pair, and device-targeted
  realtime revocation are implemented; manual and physical evidence remains.
- **Scope/work:** session restore/logout, creation/switching, pairing, forget/revoke, terminology,
  onboarding/errors and multiple devices.
- **Testing/docs:** automated capability/hub/client regression coverage plus the manual and physical
  matrix in [Phase 5 validation](account-household-validation.md).
- **Dependencies/non-goals:** may run beside phases 2–4; no enterprise RBAC/SSO.
- **Exit criteria:** setup, pair, switch, revoke/forget, and recover without database intervention;
  active web-initiated revoke disconnects only the targeted mobile, and revoked queued work never
  silently uploads or disappears.
- **Risk/branch:** stale household data crossing context. `feature/mvp-account-household-polish`.

## Phase 6: Backup and restore

- **Purpose/current state:** make irreplaceable inventory recoverable; currently absent.
- **Scope/work:** consistent PostgreSQL snapshot, intended media, manifest, app/schema versions,
  checksums, validation, restore, failures, retention, optional encryption, and first local/external-SSD
  destination behind provider-neutral orchestration.
- **Testing/docs:** restore realistic data/media into a clean test environment; corrupt/incompatible
  archive and excluded-secret behavior.
- **Dependencies/non-goals:** canonical data/media sufficiently stable; no requirement for cloud providers.
- **Exit criteria:** a verified backup restores expected household, hierarchy, items, identifiers and media.
- **Risk/branch:** database/media consistency and unsafe partial restore. `feature/mvp-backup-restore`.

## Phase 7: Raspberry Pi and operational hardening

- **Purpose/current state:** evolve Docker-oriented guidance into a supported appliance-like path.
- **Scope/work:** clean Pi install, startup/service/reboot, migrations/upgrades, permissions/disk space,
  external SSD configuration, health/status, backup location and recovery.
- **Testing/docs:** fresh supported Pi, restart/reboot/update/migration, low-space and restore drills.
- **Dependencies/non-goals:** phase 6 expectations; no mandatory Homebrew/Deb/prebuilt image.
- **Exit criteria:** documented clean Pi persists across reboot and tested update/recovery.
- **Risk/branch:** architecture, storage and power-loss variation. `feature/mvp-pi-operations`.

## Phase 8: Future-readiness architecture gate

- **Purpose/current state:** review the architecture produced by MVP work, not build future systems.
- **Scope/work:** capability reuse, actor context, authorization evolution, idempotency, confirmation,
  capability-owned transactions/events, stable resources/IDs, identifier neutrality, backup ports,
  optional AI, versioned contracts, location migration path, authored UI, and OpenAPI client parity.
- **Testing/docs:** trace representative read/write flows from each current adapter; record gaps/ADR if a
  decision changes. Recommend minimal audit persistence before any external automated mutation adapter;
  it need not block MVP while such adapters remain disabled.
- **Dependencies/non-goals:** observe phases 1–7; no MCP, AI, assistant, generative UI or broker build.
- **Exit criteria:** no known MVP decision forces a major rewrite for documented future adapters.
- **Risk/branch:** aspirational interfaces masking route logic. `refactor/mvp-capability-boundaries`.

Frontend component ownership is now governed by
[the component architecture](../architecture/frontend-component-architecture.md). The first slice adds
typed global feature actions and removes quick-create navigation used only to mount create dialogs. The
audit records oversized web/mobile orchestrators that still require behavior-preserving extraction before
this architecture gate can be considered complete.

## Phase 9: Release candidate validation

- **Purpose/current state:** validate a release as a system; not started.
- **Scope/work:** fresh install, acceptance workflow, physical devices, offline/multi-client, restart/reboot,
  backup/restore, migration/upgrade, realistic volume and recovery; fix blockers only.
- **Testing/docs:** complete the release checklist with evidence and supported/deferred notes.
- **Dependencies/non-goals:** all release gates; no speculative features during stabilization.
- **Exit criteria:** every required checklist item passes or is explicitly unsupported/deferred without
  contradicting MVP scope; repository is eligible for the first MVP tag.
- **Risk/branch:** late cross-feature failures. `chore/mvp-release-validation`.

## Dependencies and parallel work

Phase 1 stabilizes mutation/location semantics needed by phases 2 and 4. Phases 2, 3, and 5 can then
proceed largely in parallel; physical validation can begin earlier. Phase 6 needs a stable-enough
data/media model and informs phase 7. Phase 8 reviews actual results and can continuously guide work,
but closes after phases 1–7. Phase 9 consumes every blocker-clearing result.

## MVP release blockers

- Broken core inventory/location/movement workflow or incorrect resolved locations.
- Search cannot reliably find known inventory.
- A claimed supported QR/NFC workflow fails physical-device validation.
- Offline replay loses data or creates duplicates; clients fail to converge.
- Critical authentication or household-isolation defect; corrupting migration/data risk.
- Backup cannot be verified and restored with intended database/media contents.
- Supported Pi installation cannot cleanly install, migrate, restart, survive reboot, or recover.

Absent AI, MCP, assistants, generative UI, 3D/AR, advanced recommendations, extra cloud backup
providers, Homebrew packaging, or a prebuilt Pi image are not blockers.
