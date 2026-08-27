#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

command -v node >/dev/null || { echo "Node.js is required. Install Node 22 with nvm." >&2; exit 1; }
command -v corepack >/dev/null || { echo "Corepack is required (included with Node 22)." >&2; exit 1; }
command -v uv >/dev/null || { echo "uv is required: https://docs.astral.sh/uv/" >&2; exit 1; }

node_major="$(node -p 'process.versions.node.split(".")[0]')"
if [[ "$node_major" != "22" ]]; then
  echo "WhereHouse requires Node 22; found $(node --version). Run: nvm use" >&2
  exit 1
fi

echo "Installing JavaScript dependencies with Node $(node --version)..."
corepack pnpm install

echo "Installing backend dependencies..."
(cd backend && uv sync)

echo "Setup complete. Run ./dev.sh to start the web app and API."
