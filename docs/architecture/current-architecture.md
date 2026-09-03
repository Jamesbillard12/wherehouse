# WhereHouse Architecture

This document describes the implemented/current architecture. For the intended evolution and its
dependency rules, see the [future architecture overview](future-architecture.md) and
[architecture decision records](adr/README.md).

## Goals

WhereHouse must run both self-hosted on a Raspberry Pi and in the cloud without changing client behavior.

The core rule is: **clients talk to a versioned API and do not care where that API is hosted.**

## Stack

- Web: React + Vite + TypeScript
- Mobile companion: React Native + Expo + TypeScript
- Backend: Python + FastAPI
- Validation: Pydantic
- ORM: SQLAlchemy 2
- Migrations: Alembic
- Server database: PostgreSQL
- Mobile offline database: SQLite
- Python tooling: uv, Ruff, Pytest
- TypeScript tooling: pnpm, Vitest
- Local deployment: Docker Compose + Caddy; Raspberry Pi appliance packaging with systemd/Avahi
- Cloud web hosting: Netlify-compatible static build
- Cloud API: containerized FastAPI service
- Object storage: local filesystem or S3-compatible provider
- API contract: OpenAPI-generated TypeScript client

## Deployment modes

### Self-hosted

Raspberry Pi runs:

- Caddy
- React static build
- FastAPI
- PostgreSQL
- local object storage

Recommended target: Raspberry Pi 4 with 4 GB minimum, preferably Pi 5 with SSD storage.

The preferred self-hosted distribution is a model-specific Raspberry Pi OS Lite 64-bit image built
with `rpi-image-gen`. It embeds the same Compose services and ARM64 images, generates unique instance
state on first boot, publishes `wherehouse.local`, and reports nonsensitive instance/storage health
through a transport-neutral capability. See [ADR 0011](adr/0011-raspberry-pi-appliance.md).

### Cloud

- React web app hosted on Netlify
- FastAPI hosted on a container platform
- managed PostgreSQL
- S3-compatible object storage

## API

The implemented `/api/v1` REST surface covers account/session, workspaces, devices and pairing,
areas, zones, containers and placements, items and placements/images, physical identifiers, and
workspace realtime events. Transfers, activities, checkouts, a general sync API, and server PDF
labels are not implemented. FastAPI exposes OpenAPI; the TypeScript client is currently handwritten,
so generated clients or automated parity checks remain future-readiness work.

Inventory findability is exposed by transport-neutral `SearchItems` and `SearchContainers`
application capabilities. Their `/api/v1/workspaces/{workspace_id}/.../search?q=...` adapters return
typed item/container results with canonical resolved paths. The capabilities own access checks,
normalization, deterministic ordering, active-record semantics, and bounded database queries. The
shared TypeScript client is used by both connected clients; mobile alone retains a documented
SQLite-cache fallback for offline search.

## Mobile pairing

The companion app pairs to an application instance using a short-lived one-time QR code.

Pairing establishes:

- instance URL
- workspace identity
- user/device identity
- device credentials

Credentials are stored in secure device storage, not SQLite.

The pairing and credential lifecycle is documented in
[Authentication, devices, and pairing](authentication.md).

## Offline architecture

PostgreSQL is canonical. SQLite is the mobile replica/cache.

The companion caches areas, zones, containers/placements, items/placements, and supports local
browsing/search. The supported offline mutation set is `item.create` version 1 only. SQLite persists
its stable operation ID, workspace, versioned payload, state, attempts/backoff, error, remote ID, and
transactionally written optimistic cache rows. The server uses workspace-scoped operation uniqueness
and payload hashing for retry-safe creation. Item edit/move/quantity/archive and other writes are
online-only; do not infer broader offline support from cached entities. Physical restart, reconnect,
and multi-client validation remains outstanding.

## Sync

There is no general push/pull sync endpoint. Mobile replays its creation queue through the ordinary
item-create endpoint and then fetches canonical collections. Workspace WebSocket events invalidate
clients after mutations; events are in-process and are neither durable sync history nor audit.
Creation conflicts are deterministic: reuse of an operation ID with a different payload is a permanent
conflict; mutable-resource conflicts remain outside offline scope rather than using last-write-wins.

## Storage abstraction

The image service supports configured local filesystem or S3-compatible primary media storage.
The separate backup subsystem creates versioned, verified PostgreSQL-and-media artifacts and stores
them through local/external-volume or Dropbox adapters behind one provider interface. Restore uses
the same provider-neutral artifact path; see [storage and backup](storage-and-backup.md).

## AI

No AI provider or orchestration is implemented. Core behavior has no AI dependency. Add a
provider-neutral port only with a scheduled consumer and keep SDKs outside domain/application logic.

## QR labels

The clients generate/display QR images and web prints labels through a print view. Opaque
`PhysicalIdentifier` public IDs resolve to items or containers without exposing internal UUIDs;
human-readable item/container codes remain compatibility identifiers. There is no server PDF label
generator.

Identifier registration, resolution, activation, and revocation are application capabilities with
framework-neutral actor context and workspace membership enforcement. QR identifiers activate at
creation. NFC identifiers remain pending until the native client writes and reads back the exact
versioned NDEF URI; only then does it request activation. Activation/revocation retries are safe,
revoked identifiers cannot reactivate, and resolution verifies that the target still belongs to the
identifier workspace. Physical platform support remains conditional on the evidence recorded in the
[Phase 3 validation matrix](../product/physical-identifier-validation.md). Physical iOS and Android
validation is not recorded in the repository.

## Monorepo

```text
wherehouse/
├── apps/
│   ├── web/
│   └── mobile/
├── backend/
├── packages/
│   └── api-client/
├── deploy/
│   ├── docker/
│   ├── raspberry-pi/
│   └── cloud/
├── docs/
├── docker-compose.yml
└── README.md
```

## Module boundaries

Modularity is a project requirement, not an optional cleanup step. New functionality should be
placed in the smallest domain module that owns it instead of extending an unrelated entrypoint.

### Web

```text
apps/web/src/
├── features/          # Domain views, feature components, and feature hooks
│   ├── auth/
│   ├── dashboard/
│   ├── workspaces/
│   ├── items/
│   └── locations/
├── shared/            # Cross-feature UI utilities and browser helpers
├── styles/            # Base, dashboard, inventory, and responsive style layers
├── App.tsx             # Account/session composition only
└── main.tsx            # Browser entrypoint only
```

Feature-specific behavior stays within its feature. Logic used by multiple features belongs in
`shared`; server communication belongs in `@wherehouse/api-client`.

### Mobile

```text
apps/mobile/src/
├── components/        # Reusable presentation and navigation components
├── screens/           # Route/tab-level screens
├── services/          # Pairing, secure persistence, and inventory synchronization
└── theme/             # Shared React Native styles and future tokens
```

`App.tsx` coordinates application state and screen selection. It should not contain complete
screen implementations or persistence/networking implementations.

### Backend

```text
backend/app/
├── api/v1/routes/     # Thin HTTP controllers grouped by domain
├── repositories/      # Database lookup and query boundaries
├── services/          # Business logic and infrastructure providers
├── models/            # SQLAlchemy persistence models
├── schemas/           # Pydantic request and response contracts
├── core/              # Configuration and security primitives
└── db/                # Database engine and session setup
```

Routes own HTTP concerns. Repositories own persistence queries. Services own reusable business or
infrastructure behavior. Routes should not accumulate unrelated domain operations.

The current routes still own a meaningful amount of validation, transaction, persistence, and
realtime-publication behavior. New or materially changed use cases should move incrementally behind
the application capability boundary described in
[ADR-0001](adr/0001-application-capabilities.md); this is a direction, not a request for a bulk
rewrite.

### Shared TypeScript client

```text
packages/api-client/src/
├── client.ts          # Transport and error handling
├── types.ts           # Shared API contracts
├── resources/         # Domain-specific API operations
├── remote.ts          # Paired-instance client composition
└── index.ts           # Public package exports only
```

Only logic genuinely shared by web and mobile belongs in this package. Platform-specific storage,
navigation, and presentation remain in their respective applications.
## Realtime synchronization

Inventory writes continue to use the versioned REST API as the source of truth. Authenticated
clients also connect to `/api/v1/realtime`, authenticate in their first WebSocket message, and
subscribe to one workspace. Successful area, zone, container, placement, item, and image mutations
emit a small `inventory.changed` invalidation event. Clients then refetch canonical state instead of
trying to apply partial records from the socket.

The mobile client flushes its offline write queues before refetching after a reconnect. The web
client refreshes its active inventory views. Reconnects use exponential backoff and always trigger
a reconciliation fetch, so missed messages do not leave either client stale.

The current realtime hub is process-local and is appropriate for the single API process used by
local and initial self-hosted deployments. A multi-worker or multi-instance deployment must add a
shared fan-out adapter such as PostgreSQL `LISTEN/NOTIFY` or Redis pub/sub while retaining the same
WebSocket event contract.

The hub also indexes device-authenticated sockets independently of their active workspace
subscription. A post-commit `device.revoked` event is delivered only to the affected device and its
active sockets are closed; unrelated devices continue normally. Revoked credentials fail ordinary
REST authentication and future WebSocket authentication. The transient event improves recovery UX,
while database-backed credential checks remain the security authority.
