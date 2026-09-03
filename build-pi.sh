#!/bin/sh
set -eu

repository=$(git rev-parse --show-toplevel 2>/dev/null || true)
if [ -z "$repository" ]; then
  echo "Run this script from inside the WhereHouse repository." >&2
  exit 1
fi

cd "$repository"

device=${1:-pi4}
ssh_key=${WHEREHOUSE_SSH_PUBLIC_KEY_FILE:-$HOME/.ssh/id_ed25519.pub}

case "$device" in
  pi4|pi5) ;;
  *)
    echo "Usage: ./build-pi.sh [pi4|pi5]" >&2
    exit 2
    ;;
esac

if [ -f "$ssh_key" ]; then
  echo "Building next WhereHouse image for $device with SSH diagnostics enabled"
  WHEREHOUSE_SSH_PUBLIC_KEY_FILE="$ssh_key" \
    ./deploy/raspberry-pi/image/build-image.sh next "$device"
else
  echo "SSH public key not found at $ssh_key"
  echo "Building next WhereHouse image for $device without SSH diagnostics"
  ./deploy/raspberry-pi/image/build-image.sh next "$device"
fi
