# WhereHouse agent guide

## Purpose

WhereHouse is a local-first household inventory and spatial-organization platform. It supports web,
mobile, Raspberry Pi self-hosting, and cloud deployment today, and is intended to support QR
identification, AI-assisted interaction, MCP, smart assistants, controlled generative UI, digital
twins, and AR item finding later. Design for extension; do not speculatively implement future work.

Read [the architecture index](docs/README.md) and the documents relevant to your change.

## Architecture rules

- Keep domain and application behavior independent of React, React Native, HTTP/FastAPI, MCP and
  assistant SDKs, AI providers, and spatial/AR frameworks.
- Put reusable use cases in a focused application/service layer. UI, REST, MCP, voice, and AI
  adapters must call the same capabilities; do not duplicate business logic.
- Keep API and future MCP/assistant handlers thin: authenticate, parse, invoke, map the result.
- Keep persistence behind explicit repository boundaries. Application services own transaction and
  event semantics; route handlers do not.
- Organize web and mobile code by responsibility. Prefer small modules over unrelated additions to
  large screens or entrypoints.
- Put cross-client API contracts in `packages/api-client`; do not put platform-specific behavior
  there. Introduce broader shared packages only when at least two consumers need them.
- Prefer domain-oriented APIs over endpoints shaped for one screen.
- Use migrations for database changes, preserve data, prefer additive evolution, and keep stable IDs.
- Treat household inventory as private. Validate untrusted API, AI, and MCP input; authorize every
  capability; avoid logging inventory contents.

## Future compatibility

- Treat locations as stable domain entities, not display strings. Do not assume a fixed hierarchy
  depth or that every node is a room or bin.
- Keep ordinary inventory usable without dimensions, coordinates, scanning, AI, or cloud services.
  Spatial metadata is optional and technology-neutral.
- Keep QR/public identifiers distinct from internal UUIDs and resolvable through explicit records.
- Generative UI uses a versioned schema and an approved component/action registry—never arbitrary
  AI-generated React or React Native code.
- MCP and assistant integrations are adapters over application capabilities, never a second backend.
- AI proposes or orchestrates. Validate all outputs, require confirmation for consequential writes,
  and keep core inventory fully functional without AI.
- Preserve local operation for the API, database, web app, mobile cache, and future MCP server. Cloud
  services may enhance, but must not be required for core inventory.
- Add simple in-process domain/application events only when there is a current consumer. Do not add
  an event bus, microservices, or distributed infrastructure speculatively.

## UI architecture

- Treat shadcn/ui, Base UI, Tailwind, gluestack-ui, and other presentation libraries as adapter
  details. Shared application code, design tokens, and UI schemas must not depend on their APIs.
- On web, use shadcn/ui with its currently supported primitives (Base UI by default for new
  components) and Tailwind as the preferred low-level foundation. Adopt it incrementally; do not
  rewrite working screens only for consistency.
- On mobile, preserve native React Native interaction and accessibility patterns. Evaluate
  gluestack-ui as the leading component-foundation candidate before adoption; do not force web
  abstractions onto mobile.
- Share WhereHouse-owned semantic design tokens and behavior, not necessarily component
  implementations. Map tokens into each platform's styling system.
- Prefer product-level components such as `ItemCard`, `LocationCard`, `MoveItemForm`, and
  `SpatialView` above platform primitives. Do not leak primitive-library props into shared schemas.
- Generative UI may reference only the versioned WhereHouse semantic component/action registry and
  must never generate arbitrary React or React Native code at runtime.
- Keep 3D and AR renderers platform-specific behind semantic WhereHouse components such as
  `SpatialView`; shared contracts must not expose Three.js, React Three Fiber, or native spatial APIs.

## Capability and testing expectations

Express behavior through capabilities such as `SearchItems`, `GetItem`, `AddItem`, `UpdateItem`,
`MoveItem`, `DeleteItem`, `CreateLocation`, `UpdateLocation`, `SearchLocations`, and
`GetLocationContents`. Pass an actor/request context containing identity, client, permissions, and
confirmation metadata into capability calls when relevant.

- Test new business rules at the application/domain level.
- Add route/component tests for adapter behavior and integration tests for critical workflows.
- Run relevant tests, Ruff, and TypeScript type checks before finishing.
- Update architecture docs or an ADR for decisions with long-term consequences.

## Workflow

1. Inspect existing code and local `AGENTS.md` guidance before editing.
2. Make the smallest coherent change and avoid unrelated refactors.
3. Keep business logic, persistence, transport, UI, and platform integrations separated.
4. Verify behavior and documentation links; summarize decisions and checks.
5. Start from updated `main` on a descriptive branch unless instructed otherwise. Do not merge.

Do not add cloud dependencies to core workflows, replace major frameworks, generate runtime UI code,
break self-hosting, or implement future MCP/AI/spatial systems unless the task explicitly requests it.
