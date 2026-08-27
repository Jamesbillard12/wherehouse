#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

command -v docker >/dev/null || { echo "Docker is required." >&2; exit 1; }
if ! docker info >/dev/null 2>&1; then
  echo "Docker is installed, but its daemon is not running; there are no reachable services to stop." >&2
  exit 1
fi
docker compose down
