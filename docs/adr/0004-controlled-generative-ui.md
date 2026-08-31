# ADR-0004: Controlled generative UI schema

- **Status:** Accepted
- **Date:** 2026-08-31

## Context

AI-selected interfaces could answer varied inventory requests, but arbitrary generated frontend code
is unsafe, inconsistent, inaccessible, and difficult to support across web and mobile.

## Decision

Generative UI is a versioned semantic document using approved components and actions. Each client
maps semantics to native components. Schemas, limits, permissions, capability actions, confirmation,
and fallbacks are enforced before render/execute. Authored UI continues to coexist.

## Alternatives considered

- Generate React/React Native at runtime: unacceptable execution and supply-chain boundary.
- Server-render one universal layout: cannot exploit native platform interaction well.
- Avoid generative UI entirely: gives up useful request-specific composition.

## Consequences

The surface is bounded, testable, and cross-platform, at the cost of registry governance and version
compatibility. AI can only express supported experiences.

## Now

Document component/action semantics and preserve reusable native components/capabilities.

## Deferred

Schema package, model producer, renderers, and mutation surfaces until there is a scheduled consumer.
