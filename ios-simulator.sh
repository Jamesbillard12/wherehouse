#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "The iOS app can only be built on macOS." >&2
  exit 1
fi

if ! command -v node >/dev/null || [[ "$(node -p 'process.versions.node.split(".")[0]')" != "22" ]]; then
  shopt -s nullglob
  node_22_bins=( "${NVM_DIR:-$HOME/.nvm}"/versions/node/v22*/bin )
  shopt -u nullglob
  if (( ${#node_22_bins[@]} > 0 )); then
    node_22_index=$(( ${#node_22_bins[@]} - 1 ))
    export PATH="${node_22_bins[$node_22_index]}:$PATH"
  fi
fi

command -v node >/dev/null || { echo "Node.js is required. Run: nvm use" >&2; exit 1; }
command -v xcodebuild >/dev/null || { echo "Xcode is required. Install it from the App Store." >&2; exit 1; }
xcode-select -p >/dev/null 2>&1 || { echo "Select Xcode with: sudo xcode-select -s /Applications/Xcode.app" >&2; exit 1; }

node_major="$(node -p 'process.versions.node.split(".")[0]')"
if [[ "$node_major" != "22" ]]; then
  echo "WhereHouse requires Node 22; found $(node --version). Run: nvm use" >&2
  exit 1
fi

if [[ ! -d apps/mobile/node_modules ]]; then
  echo "Mobile dependencies are missing. Run: pnpm install" >&2
  exit 1
fi

echo "Building and launching WhereHouse in the iOS Simulator."
echo "Keep ./dev.sh running in another terminal for API access."
corepack pnpm --filter @wherehouse/mobile exec expo run:ios "$@"
