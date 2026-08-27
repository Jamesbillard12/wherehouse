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

if [[ -z "${PUBLIC_BASE_URL:-}" ]]; then
  local_ip="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
  if [[ -n "$local_ip" ]]; then
    export PUBLIC_BASE_URL="http://${local_ip}:8000"
  else
    export PUBLIC_BASE_URL="http://localhost:8000"
    echo "Could not detect a LAN address. Physical-phone pairing requires PUBLIC_BASE_URL." >&2
  fi
fi

echo "Starting PostgreSQL..."
docker compose up -d --wait postgres

echo "Applying database migrations..."
(cd backend && uv run alembic upgrade head)

echo "Starting API at http://localhost:8000 (pairing URL: ${PUBLIC_BASE_URL})..."
(cd backend && exec uv run uvicorn app.main:app --reload --host 0.0.0.0) &
api_pid=$!

cleanup() {
  kill "$api_pid" 2>/dev/null || true
  wait "$api_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting web app at http://localhost:5173..."
echo "Press Ctrl-C to stop the API and web app. PostgreSQL stays running; use ./stop.sh."
corepack pnpm --filter @wherehouse/web dev
