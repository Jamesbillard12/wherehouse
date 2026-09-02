# WhereHouse documentation

This is the canonical documentation index. WhereHouse is in **MVP hardening**: Phase 0 is complete on
the documentation branch; inventory, identifiers, sync, account and architecture work are in
progress/hardening; backup/restore is not started; Pi operations are partial; release validation is
not started. See the evidence and uncertainty in the [execution plan](product/mvp-execution-plan.md).

## Product and MVP

- [MVP definition](product/mvp.md) — user-facing requirements, architectural foundations, non-goals,
  and the primary acceptance workflow.
- [MVP execution plan](product/mvp-execution-plan.md) — current-state matrix, phase status,
  dependencies, exit criteria, blockers, risks and recommended workstreams.
- [MVP release checklist](product/mvp-release-checklist.md) — system, physical-device and operational
  validation required before the first tag.
- [Phase 2 search validation](product/search-validation.md) — exact matching semantics, offline limits,
  realistic-volume fixture, and manual web/mobile sequence.
- [Build now vs. later](product/build-now-vs-later.md) — scope guard.
- [Product roadmap](product/roadmap.md) — post-MVP household, intelligence/interface and spatial work.

## Architecture

- [Architecture index](architecture/README.md), [current](architecture/current-architecture.md), and
  [future](architecture/future-architecture.md)
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
