# Development

## Requirements

- Node.js 22+
- pnpm via Corepack
- Python 3.13+
- uv
- Docker / Docker Compose

## Web

```bash
corepack enable
pnpm install
pnpm dev:web
```

The web app runs on `http://localhost:5173` and proxies `/api` requests to the local FastAPI server.

The root `./dev.sh` command combines PostgreSQL startup, migrations, the API, and the web app for
normal development. See the root README for all convenience commands.

## API

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

The API runs on `http://localhost:8000`. OpenAPI is available at `/api/openapi.json` and interactive docs at `/api/docs`.

## Mobile

```bash
pnpm dev:mobile
```

The companion app will use SQLite for its offline replica/cache and SecureStore for device credentials.

## PostgreSQL only

For local development, PostgreSQL can be started independently with Docker Compose while the API and clients run directly on the host.
