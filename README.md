# WhereHouse

**Know what you have. Know where it is.**

WhereHouse is a local-first household inventory and spatial-organization platform for web, mobile,
Raspberry Pi self-hosting, and cloud deployment. Core workflows already cover authentication and
pairing, households/settings, inventory and location management, photos, QR/NFC identifiers, mobile
caching/queued writes, and realtime invalidation. MVP hardening is underway; backup/restore,
operational reliability, complete offline correctness, physical-device validation, and release-level
testing remain gates. WhereHouse is not production-ready.

Advanced AI, MCP, assistants, generative UI, automation, 3D and AR are intentionally post-MVP.
During MVP, capability, actor, confirmation, idempotency, identifier, contract and storage boundaries
are being established so those systems can be added without duplicating business rules.

## Technology

React/Vite/TypeScript web; React Native/Expo/TypeScript mobile; FastAPI/Pydantic/SQLAlchemy/Alembic
backend; PostgreSQL server data and SQLite mobile cache; pnpm/Vitest and uv/Pytest/Ruff; Docker
Compose/Caddy local deployment; local or S3-compatible primary media storage.

## Repository layout

```text
apps/web/                Web client
apps/mobile/             Mobile companion
backend/                 API, application capabilities, persistence and tests
packages/api-client/     Cross-client API contract/client
deploy/                  Deployment implementation material
docs/                    Canonical product, architecture, design and operations docs
```

## Run locally

With Node 22 selected through nvm:

```bash
nvm use
./setup.sh
./dev.sh
```

Web is at `http://localhost:5173`, API at `http://localhost:8000`, and API docs at
`http://localhost:8000/api/docs`. In another terminal run `./mobile.sh`; use `./ios-simulator.sh` or
`./ios-device.sh` for those targets. `./dev.sh` uses the Mac LAN address in new pairing codes; set
`PUBLIC_BASE_URL` in `.env` if needed. `./docker-up.sh` runs the container deployment at
`http://localhost:8080`; `./stop.sh` stops it.

## Documentation

Start with the [documentation index](docs/README.md), [MVP definition](docs/product/mvp.md),
[execution plan](docs/product/mvp-execution-plan.md), [release checklist](docs/product/mvp-release-checklist.md),
[architecture](docs/architecture/README.md), and [deployment guidance](docs/deployment/README.md).
