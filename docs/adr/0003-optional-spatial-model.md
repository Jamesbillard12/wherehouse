# ADR-0003: Optional provider-neutral spatial extensions

- **Status:** Accepted
- **Date:** 2026-08-31

## Context

Digital twins and AR need geometry, coordinate frames, anchors, confidence, and scan revisions.
Ordinary inventory needs none of them, and capture technologies will change.

## Decision

Keep logical locations/items/containers independent of spatial technology. Store versioned space
models and anchors as optional extensions linked by stable WhereHouse IDs. Keep large geometry in
object storage and model queryable metadata explicitly. Every spatial workflow has a logical fallback.

## Alternatives considered

- Put coordinates directly on every entity: lacks coordinate/revision context and burdens MVP data.
- Adopt RoomPlan/ARKit objects as the domain: excludes other providers and couples persistence.
- Put all spatial data in opaque JSON: easy ingestion but poor integrity/queryability.

## Consequences

Multiple scan/render providers and unscanned homes can coexist. Adapters and version conversion are
required, and precise AR depends on anchor lifecycle management.

## Now

Preserve stable IDs, optionality, object-storage abstraction, and provider-neutral terminology.

## Deferred

Schemas, capture technology, geometry format, renderer, scanning, AR, and capacity algorithms.
