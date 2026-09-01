# ADR-0001: Modular monolith with shared application capabilities

- **Status:** Accepted
- **Date:** 2026-08-31

## Context

FastAPI routes currently perform authorization, validation, persistence, transactions, and realtime
publication. Web and mobile share a REST client. MCP, assistants, and AI would duplicate rules if
routes remain the only application boundary.

## Decision

Retain the modular monolith and introduce framework-neutral, intent-oriented application capabilities
incrementally. Capabilities receive actor context, use repository/infrastructure ports, own
transaction/event semantics, and are invoked by thin transport adapters.

## Alternatives considered

- Keep behavior in routes: fastest short term, but prevents safe reuse.
- Create microservices: adds deployment and consistency cost without current scale evidence.
- Bulk clean-architecture rewrite: high regression/migration cost with little immediate product value.

## Consequences

Business rules become directly testable and reusable. Some temporary old/new patterns will coexist,
and port boundaries add modest indirection.

## Now

Extract the next materially changed item/location use case and move realtime publication with it.
Keep one deployable API and PostgreSQL database.

## Deferred

Bulk route migration, service decomposition, durable broker/outbox, and microservices.
