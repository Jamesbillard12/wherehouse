# ADR-0002: First-class hierarchical locations

- **Status:** Proposed
- **Date:** 2026-08-31

## Context

The MVP has stable UUID-backed Areas and Zones followed by arbitrary nested Containers. This supports
common storage but fixes the first levels and splits “where” across tables. Future walls, shelves,
spaces, anchors, and consistent APIs need arbitrary depth without requiring spatial data.

## Decision

The target domain has a first-class `Location` entity with stable ID, household, optional parent,
open-ended type, name, and optional description. It forms an acyclic arbitrary-depth tree. Containers
remain physical entities that can be placed at locations or in/on other containers. Spatial metadata
is optional and separate.

## Alternatives considered

- Extend Area/Zone with more fixed levels: simple but repeats the limitation.
- Treat every node as a Container: loses the distinction between physical space and movable holder.
- Store a breadcrumb/string path: weak integrity, identity, rename, authorization, and spatial links.

## Consequences

Queries and clients gain one logical hierarchy, but migration and compatibility are non-trivial.
Product guidance is needed for ambiguous fixtures such as built-in versus movable shelves.

## Now

Preserve current schema and IDs, prevent cycles, and avoid new fixed hierarchy assumptions. Design a
data-preserving migration and API compatibility plan before implementation.

## Deferred

The migration, compatibility projection details, spatial fields, and automatic type inference.
