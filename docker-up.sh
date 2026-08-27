#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

command -v docker >/dev/null || { echo "Docker is required." >&2; exit 1; }

if ! docker info >/dev/null 2>&1; then
  echo "Docker is installed, but its daemon is not running." >&2
  echo "Open Docker Desktop, wait until it reports that Docker is running, then retry ./docker-up.sh." >&2
  exit 1
fi

echo "Building and starting WhereHouse at http://localhost:8080..."
docker compose up --build
