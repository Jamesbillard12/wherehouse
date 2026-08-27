# WhereHouse Architecture

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

Versioned REST API:

- `/api/v1/households`
- `/api/v1/items`
- `/api/v1/containers`
- `/api/v1/transfers`
- `/api/v1/activities`
- `/api/v1/checkouts`
- `/api/v1/pairing`
- `/api/v1/sync`
- `/api/v1/labels`

FastAPI generates OpenAPI. A TypeScript client is generated and consumed by both the web and mobile apps.

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

The companion app can work offline for:

- search
- scanning
- item creation
- item movement
- container movement
- transfers
- checkouts and returns
- activity checklist completion
- container space updates

Offline writes are stored as pending operations and synchronized when the server is available.

## Sync

Initial shape:

- `POST /api/v1/sync/push`
- `GET /api/v1/sync/pull?cursor=...`

Location conflicts should be surfaced rather than silently resolved.

## Storage abstraction

The backend uses a storage interface with at least:

- LocalStorageBackend
- S3StorageBackend

This supports local Raspberry Pi deployments and cloud deployments with the same application code.

## AI abstraction

AI calls go through an internal AI service interface rather than directly from inventory code.

Initial provider can be OpenAI. Future providers may include local models.

## QR labels

The backend generates printable QR labels, initially as PDFs.

Raw UUIDs are not printed. Public scannable IDs such as `itm_K8F4Q2` and `cnt_7RM9P1` resolve to internal UUIDs.

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
