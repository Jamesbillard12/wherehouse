#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

command -v docker >/dev/null || { echo "Docker is required for PostgreSQL." >&2; exit 1; }
command -v node >/dev/null || { echo "Node.js is required. Run: nvm use" >&2; exit 1; }
command -v uv >/dev/null || { echo "uv is required: https://docs.astral.sh/uv/" >&2; exit 1; }

if ! docker info >/dev/null 2>&1; then
  echo "Docker is installed, but its daemon is not running." >&2
  echo "Open Docker Desktop, wait until it reports that Docker is running, then retry ./dev.sh." >&2
  exit 1
fi

node_major="$(node -p 'process.versions.node.split(".")[0]')"
if [[ "$node_major" != "22" ]]; then
  echo "WhereHouse requires Node 22; found $(node --version). Run: nvm use" >&2
  exit 1
fi

echo "Starting PostgreSQL..."
docker compose up -d --wait postgres

echo "Applying database migrations..."
(cd backend && uv run alembic upgrade head)

echo "Starting API at http://localhost:8000..."
(cd backend && exec uv run uvicorn app.main:app --reload) &
api_pid=$!

cleanup() {
  kill "$api_pid" 2>/dev/null || true
  wait "$api_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting web app at http://localhost:5173..."
echo "Press Ctrl-C to stop the API and web app. PostgreSQL stays running; use ./stop.sh."
corepack pnpm --filter @wherehouse/web dev
