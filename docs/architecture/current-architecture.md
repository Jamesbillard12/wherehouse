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
- Local deployment: Docker Compose + Caddy
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

### Cloud

- React web app hosted on Netlify
- FastAPI hosted on a container platform
- managed PostgreSQL
- S3-compatible object storage

## API

The implemented `/api/v1` REST surface covers account/session, households, devices and pairing,
areas, zones, containers and placements, items and placements/images, physical identifiers, and
household realtime events. Transfers, activities, checkouts, a general sync API, and server PDF
labels are not implemented. FastAPI exposes OpenAPI; the TypeScript client is currently handwritten,
so generated clients or automated parity checks remain future-readiness work.

Item findability is exposed by `SearchItems`, a transport-neutral application capability invoked by
`GET /api/v1/households/{household_id}/items/search?q=...`. It owns access checks, normalization,
deterministic ordering, active-item semantics, the bounded database query, and canonical resolved
paths. The shared TypeScript client is used by both connected clients; mobile alone retains a
documented SQLite-cache fallback for offline search.

## Mobile pairing

The companion app pairs to an application instance using a short-lived one-time QR code.

Pairing establishes:

- instance URL
- household identity
- user/device identity
- device credentials

Credentials are stored in secure device storage, not SQLite.

The pairing and credential lifecycle is documented in
[Authentication, devices, and pairing](authentication.md).

## Offline architecture

PostgreSQL is canonical. SQLite is the mobile replica/cache.

The companion caches areas, zones, containers/placements, items/placements, and supports local
browsing/search. Pending SQLite queues currently cover item creation and item updates; creation uses
a stable client operation ID with a database uniqueness constraint and payload conflict detection.
Do not infer offline item/container movement, transfer, checkout, activity, or capacity mutation
support from the cache. Restart/reconnect/conflict/exactly-once behavior still needs release validation.

## Sync

There is no general push/pull sync endpoint. Mobile fetches canonical resource collections and
replays its item queues through ordinary resource endpoints. Household WebSocket events invalidate
clients after mutations; events are in-process and are neither durable sync history nor audit.
Conflict semantics beyond idempotent creation need definition and validation.

## Storage abstraction

The image service supports configured local filesystem or S3-compatible primary media storage.
This is separate from the not-yet-implemented provider-neutral backup/restore subsystem; see
[storage and backup](storage-and-backup.md).

## AI

No AI provider or orchestration is implemented. Core behavior has no AI dependency. Add a
provider-neutral port only with a scheduled consumer and keep SDKs outside domain/application logic.

## QR labels

The clients generate/display QR images and web prints labels through a print view. Opaque
`PhysicalIdentifier` public IDs resolve to items or containers without exposing internal UUIDs;
human-readable item/container codes remain compatibility identifiers. There is no server PDF label
generator. Physical iOS and Android validation is not recorded in the repository.

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
│   ├── households/
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
subscribe to one household. Successful area, zone, container, placement, item, and image mutations
emit a small `inventory.changed` invalidation event. Clients then refetch canonical state instead of
trying to apply partial records from the socket.

The mobile client flushes its offline write queues before refetching after a reconnect. The web
client refreshes its active inventory views. Reconnects use exponential backoff and always trigger
a reconciliation fetch, so missed messages do not leave either client stale.

The current realtime hub is process-local and is appropriate for the single API process used by
local and initial self-hosted deployments. A multi-worker or multi-instance deployment must add a
shared fan-out adapter such as PostgreSQL `LISTEN/NOTIFY` or Redis pub/sub while retaining the same
WebSocket event contract.
