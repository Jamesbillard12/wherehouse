# WhereHouse roadmap

This roadmap reflects the repository state in August 2026. Phases communicate dependency order, not
dates. A later phase must not make earlier local workflows depend on it.

## Phase 1 — Reliable inventory foundation (current)

Finish and harden item, area, zone, container, placement, photo, identifier, search, authentication,
pairing, mobile cache/queue, realtime reconciliation, and Pi deployment workflows. Add integration
coverage for hierarchy cycles, moves, authorization, and offline replay.

**Exit:** a household can organize, label, find, move, back up, and restore inventory locally.

## Phase 2 — Reusable capability boundary

Introduce actor context and extract changed use cases from routes into tested application
capabilities. Establish transaction/repository boundaries, idempotent writes, typed in-process
events, contract parity checks, and a minimal audit model. Decide the unified location migration.

**Depends on:** Phase 1 behavior being testable.
**Unlocks:** safe reuse by every later interface.

## Phase 3 — Unified hierarchy, QR, and mobile quality

Evolve Area/Zone/Container compatibility toward an arbitrary-depth first-class location model while
preserving existing IDs/data and distinguishing movable containers. Improve QR linking, fast mobile
entry, photos/search, conflict handling, and optional manual dimensions.

**Depends on:** capability boundary and owner decisions on location/container semantics.
**Unlocks:** stable resources for MCP and stable targets for spatial models.

## Phase 4 — AI-assisted and natural-language workflows

Add provider-neutral AI ports for optional extraction, search interpretation, summaries, and storage
suggestions. Retain proposals separately, display provenance/confidence, require user review for
canonical changes, and keep manual/local workflows complete.

**Depends on:** capabilities, audit, confirmation, and permission context.

## Phase 5 — MCP and external assistants

Ship a local read-only MCP slice, then scoped/confirmed writes and secure remote operation. Add deep
links and platform intent/voice adapters based on validated use cases.

**Depends on:** stable capabilities, location IDs, scopes, audit, idempotency, confirmation.
**Deferred within phase:** broad platform coverage until usage validates it.

## Phase 6 — Controlled generative UI

Create the versioned semantic schema/registry and one read-only web/mobile surface. Add validated
actions, fallback/capability negotiation, permission filtering, then confirmed mutation forms.

**Depends on:** stable capability/action contracts and mature native components.

## Phase 7 — Spatial foundation and 3D visualization

Prototype capture providers and renderers; add optional versioned space models, geometry storage,
anchors, dimensions/capacity, confidence, and stale-anchor handling. Ship logical fallbacks and a
basic viewer before automated recommendations.

**Depends on:** unified logical hierarchy, stable IDs, object storage/backup, device prototypes.

## Phase 8 — Scanning, digital twins, and AR guidance

Add user-confirmed scan-to-location suggestions, QR/anchor association, scan revisions, device
relocalization, and progressive AR guidance. Never silently rewrite inventory from detection.

**Depends on:** spatial foundation, reliable anchors, and validated mobile hardware coverage.

## Phase 9 — Spatial storage intelligence

Add fit, occupancy, weight, consolidation, and placement recommendations with transparent assumptions
and user confirmation. Begin with normalized manual measurements and simple algorithms before
vision-derived estimates or packing optimization.

**Depends on:** trustworthy dimensions, capacity, containment, confidence, and movement audit data.

## Cross-cutting gates

Privacy/security review, accessible non-spatial fallbacks, local/Pi performance, backup/restore, data
migration, offline behavior, and schema compatibility are release gates for every phase.
