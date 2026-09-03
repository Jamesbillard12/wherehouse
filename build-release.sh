#!/bin/sh
set -eu

repository=$(git rev-parse --show-toplevel)
exec python3 "$repository/deploy/raspberry-pi/release/build_release.py" "${1:-next}"
