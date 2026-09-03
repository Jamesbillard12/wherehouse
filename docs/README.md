# WhereHouse documentation

This is the canonical documentation index. WhereHouse is in **MVP hardening**: Phase 0 is complete;
inventory and sync remain in hardening; search, identifiers, and account/household/device work are
ready for validation; backup/restore implementation is in progress with real round trips outstanding;
Pi operations are partial; release validation is not started. See the evidence and uncertainty in
the [execution plan](product/mvp-execution-plan.md).

## Product and MVP

- [MVP definition](product/mvp.md) — user-facing requirements, architectural foundations, non-goals,
  and the primary acceptance workflow.
- [MVP execution plan](product/mvp-execution-plan.md) — current-state matrix, phase status,
  dependencies, exit criteria, blockers, risks and recommended workstreams.
- [MVP release checklist](product/mvp-release-checklist.md) — system, physical-device and operational
  validation required before the first tag.
- [Phase 2 search validation](product/search-validation.md) — exact matching semantics, offline limits,
  realistic-volume fixture, and manual web/mobile sequence.
- [Phase 3 physical identifier validation](product/physical-identifier-validation.md) — implemented
  QR/NFC guarantees, physical iOS/Android matrix, printed-label check, and current limitations.
- [Phase 4 offline sync validation](product/offline-sync-validation.md) — supported mutation envelope,
  retry/conflict behavior, unsupported-write UX, and restart/reconnect/multi-client evidence matrix.
- [Phase 5 account and household validation](product/account-household-validation.md) — session,
  switching, pairing, targeted realtime revocation, re-pairing, and queued-work recovery evidence.
- [Phase 6 backup and restore validation](product/backup-restore-validation.md) — automated evidence
  plus local/external-volume, Dropbox, clean-restore, corruption, and retention drills.
- [Build now vs. later](product/build-now-vs-later.md) — scope guard.
- [Product roadmap](product/roadmap.md) — post-MVP household, intelligence/interface and spatial work.

## Architecture

- [Architecture index](architecture/README.md), [current](architecture/current-architecture.md), and
  [future](architecture/future-architecture.md)
- [Frontend component architecture](architecture/frontend-component-architecture.md) — ownership,
  feature actions, forms/dialogs, state, sharing, testing, and UI anti-patterns.
- [Domain model](architecture/domain-model.md), [authentication](architecture/authentication.md),
  [offline/sync](architecture/offline-sync.md), and [settings](architecture/settings.md)
- [Storage and backup](architecture/storage-and-backup.md)
- [AI, MCP, assistants and integrations](architecture/external-integrations.md), [controlled
  generative UI](architecture/generative-ui.md), and [spatial direction](architecture/spatial-architecture.md)
- [Architecture decisions](architecture/adr/README.md)

## Design, deployment and development

- [Design index](design/README.md)
- [Deployment index](deployment/README.md), including [Raspberry Pi](deployment/raspberry-pi.md),
  [cloud](deployment/cloud.md), and [backup/restore](deployment/backup-and-restore.md)
- [Development index](development/README.md), [testing](development/testing.md), and
  [release process](development/release-process.md)
