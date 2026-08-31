# ADR-0006: Local-first core with optional AI

- **Status:** Accepted
- **Date:** 2026-08-31

## Context

WhereHouse handles private household data and targets Raspberry Pi self-hosting. AI can enhance entry,
search, and organization but cloud availability, cost, privacy, and hardware vary.

## Decision

Core inventory, location, QR, search, web/API operation, mobile cache, export, backup, and restore work
without AI or a cloud service. AI is a provider-neutral optional orchestration/proposal layer with
explicit data sharing. Local and cloud providers may implement the same port.

## Alternatives considered

- Cloud-first required services: simpler operations but breaks ownership/offline goals.
- Require a local LLM: preserves locality but exceeds many Pi resources and still adds a hard AI
  dependency.
- No AI: avoids risk but loses valuable optional assistance.

## Consequences

Manual/deterministic fallbacks require continued product investment. Provider adapters and consent
boundaries add work, while deployments remain resilient and owner-controlled.

## Now

Keep one Pi-suitable modular monolith, local storage options, mobile offline behavior, and no AI SDK
dependency in domain/application code.

## Deferred

Local LLM packaging, cloud AI integrations, provider selection, and multi-instance cloud sync.
