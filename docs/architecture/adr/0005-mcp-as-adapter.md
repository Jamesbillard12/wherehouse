# ADR-0005: MCP and assistants as adapters

- **Status:** Accepted
- **Date:** 2026-08-31

## Context

MCP and platform assistants need model-friendly discovery and interaction. Implementing inventory
rules inside each integration would create inconsistent authorization and mutations.

## Decision

MCP, voice, intents, and AI orchestration are thin adapters over shared application capabilities.
They use scoped actor identity, server-side validation, audit, idempotency, and bound confirmation for
consequential writes. Local MCP binds conservatively; remote MCP requires explicit secure setup.

## Alternatives considered

- MCP-specific database queries/services: a second backend with divergent rules.
- MCP wrapping REST internally in all deployments: reuses semantics but adds an unnecessary local
  network/auth hop and hides the true capability boundary.
- Give assistants broad owner tokens: violates least privilege and weakens attribution.

## Consequences

All interfaces share behavior and tests. Application capabilities, scopes, and audit must precede
mutating integrations.

## Now

Build the capability/actor foundation and define read versus write policies.

## Deferred

MCP server, remote transport, tools/resources, and platform-specific assistant implementations.
