# WhereHouse agent guide

WhereHouse is a local-first household inventory platform. Read the [documentation index](docs/README.md),
[MVP](docs/product/mvp.md), [current phase/status](docs/product/mvp-execution-plan.md), and relevant
architecture/ADR documents before changing it. MVP user capabilities, MVP architectural foundations,
and post-MVP implementations are distinct; do not turn future adapters into current product scope.

## Architecture rules

- Scope new domain behavior to `Workspace`, pass workspace context explicitly to backend services, and
  use `WorkspaceMembership` for access. Household terminology belongs only in household-facing UI or
  documented v1 compatibility aliases; do not add new `household_id` relationships without a documented
  compatibility reason. Web/mobile features use the centralized active-workspace identity, and relevant
  tests must prove workspace isolation. Do not implement type-specific organization behavior until
  explicitly requested, and update architecture documentation alongside changes to this boundary.
- Keep domain/application behavior independent of React, React Native, HTTP/FastAPI, MCP/assistant
  SDKs, AI providers and spatial frameworks. Transports authenticate/parse/invoke/map.
- Put reusable rules, transactions, idempotency and events in focused application capabilities behind
  repository/infrastructure ports. Do not add important rules only to REST routes.
- Ask: can web, mobile, MCP, assistants, AI, generative UI and automation reuse this operation without
  duplicating rules? Improve the boundary if not; do not prematurely build the future adapter if yes.
- Pass a framework-neutral actor/request context when relevant. Preserve evolution toward scoped
  authorization and portable confirmation evidence without building enterprise RBAC/policy engines.
- Preserve stable internal IDs and separate opaque physical/public identifiers. QR and NFC are media
  over common targets. Keep versioned contracts and operation IDs; retries must not duplicate writes.
- Realtime events synchronize clients; they are not audit. Move publication with capabilities and add
  attribution before external automated writes. Do not add brokers without a current durable consumer.
- Keep the deterministic/manual product complete without AI or cloud. AI is optional, provider-neutral,
  and proposes/orchestrates under normal validation, authorization, confirmation and audit.
- MCP and assistants are adapters, never a second backend. Controlled generative UI uses only a
  versioned semantic registry; authored UI remains complete; never generate arbitrary runtime UI code.
- Keep current Area/Zone/Container behavior usable and cycle-safe; preserve IDs and a data-preserving
  path to arbitrary-depth locations. Spatial metadata stays optional and technology-neutral.
- Keep backup orchestration provider-neutral. Never put live PostgreSQL files in consumer sync folders
  such as Dropbox/Drive/OneDrive. Preserve Pi-class/local operation and external-SSD compatibility.
- Identify appliance disks by stable hardware identity and mount external primary storage by filesystem
  UUID, never `/dev/sdX`. Root/boot protection and destructive confirmation must be enforced by the
  privileged host boundary. Missing primary storage fails closed. SMB is opt-in and may expose only
  allowlisted share roots that are separate from application data, PostgreSQL, secrets, and backups.
- Use migrations, additive evolution and explicit repository boundaries. Treat inventory as private:
  validate untrusted input, authorize every capability and avoid logging household contents.
- Do not create empty future abstractions, microservices, workflow systems or brokers without a real
  consumer. Do not add cloud dependencies to core workflows.

## UI and contracts

Web prefers incremental shadcn/Base UI and Tailwind; mobile retains native React Native patterns and
evaluates gluestack through a bounded need. Share WhereHouse semantic tokens/behavior, not primitive
props. Put cross-client contracts in `packages/api-client`; platform behavior stays in its client.

Before adding UI, inspect existing primitives, feature modules, forms, dialogs, and hooks for reuse.
Pages/screens compose reusable features; do not make a page the exclusive owner of an interaction or
navigate merely to mount it. Create/edit experiences share forms or field groups when their data overlaps.
Place UI at the narrowest correct level: generic primitive → cross-feature WhereHouse component → feature
component → page/screen. Keep state at the narrowest useful scope, prefer composition over mega-components,
and evaluate extraction before adding responsibility to an oversized component. Tests belong with the
feature boundary; update architecture docs when introducing a durable pattern.

## Workflow and verification

Inspect local guidance and actual code, make the smallest coherent change, and preserve separation of
business logic, persistence, transport and UI. Test rules at application/domain level, adapters at
route/component level, and critical workflows end to end. Run relevant Pytest/Ruff and TypeScript
tests/type checks; update architecture docs/ADR for durable decisions. Start from updated `main` on a
descriptive branch unless instructed otherwise; do not merge.

Raspberry Pi image tooling must keep upstream tools and revisions pinned, install builder dependencies
reproducibly inside Linux ARM64 Docker, require no Linux image packages on a Mac host, keep board
selection/configuration separate from generic orchestration, and update deployment evidence without
claiming image or hardware validation that was not actually run.
