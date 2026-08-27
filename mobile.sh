#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

command -v node >/dev/null || { echo "Node.js is required. Run: nvm use" >&2; exit 1; }
node_major="$(node -p 'process.versions.node.split(".")[0]')"
if [[ "$node_major" != "22" ]]; then
  echo "WhereHouse requires Node 22; found $(node --version). Run: nvm use" >&2
  exit 1
fi

echo "Starting the Expo companion. Keep ./dev.sh running in another terminal."
corepack pnpm --filter @wherehouse/mobile start
