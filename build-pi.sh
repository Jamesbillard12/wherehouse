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
update_mode=${WHEREHOUSE_UPDATE_MODE:-enabled}
update_key=${WHEREHOUSE_UPDATE_PUBLIC_KEY_FILE:-$HOME/wherehouse-keys/wherehouse-release-public.pem}
update_manifest=${WHEREHOUSE_UPDATE_MANIFEST_URL:-https://github.com/Jamesbillard12/wherehouse/releases/latest/download/release.json}

case "$device" in
  pi4|pi5) ;;
  *)
    echo "Usage: ./build-pi.sh [pi4|pi5]" >&2
    exit 2
    ;;
esac

case "$update_mode" in
  enabled|disabled) ;;
  *)
    echo "WHEREHOUSE_UPDATE_MODE must be enabled or disabled" >&2
    exit 2
    ;;
esac

if [ "$update_mode" = "enabled" ] && [ ! -f "$update_key" ]; then
  echo "OTA verification key not found: $update_key" >&2
  echo "Create $HOME/wherehouse-keys/wherehouse-release-public.pem or explicitly set WHEREHOUSE_UPDATE_MODE=disabled." >&2
  exit 1
fi

build_image() {
  if [ "$update_mode" = "enabled" ]; then
    WHEREHOUSE_UPDATE_MODE=enabled \
    WHEREHOUSE_UPDATE_MANIFEST_URL="$update_manifest" \
    WHEREHOUSE_UPDATE_PUBLIC_KEY_FILE="$update_key" \
    "$@"
  else
    WHEREHOUSE_UPDATE_MODE=disabled "$@"
  fi
}

if [ -f "$ssh_key" ]; then
  echo "Building next WhereHouse image for $device with SSH diagnostics enabled"
  echo "OTA updates: $update_mode"
  WHEREHOUSE_SSH_MODE=key \
  WHEREHOUSE_SSH_PUBLIC_KEY_FILE="$ssh_key" \
    build_image ./deploy/raspberry-pi/image/build-image.sh next "$device"
else
  echo "SSH public key not found at $ssh_key"
  echo "Building next WhereHouse image for $device without SSH diagnostics"
  echo "OTA updates: $update_mode"
  WHEREHOUSE_SSH_MODE=disabled \
    build_image ./deploy/raspberry-pi/image/build-image.sh next "$device"
fi
