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
command -v pod >/dev/null || { echo "CocoaPods is required. Install it with: brew install cocoapods" >&2; exit 1; }
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

echo "Refreshing the physical-device iOS workspace."
(
  cd apps/mobile/ios
  pod install
)

# CocoaPods generates this umbrella with a bare sqlite3.h import. Xcode can
# otherwise reuse a Simulator module that resolved Apple's header, hiding Expo
# SQLite's exsqlite3_* declarations during an iphoneos build.
expo_sqlite_umbrella="apps/mobile/ios/Pods/Target Support Files/ExpoSQLite/ExpoSQLite-umbrella.h"
if [[ ! -f "$expo_sqlite_umbrella" ]]; then
  echo "Expo SQLite's generated umbrella header is missing after pod install." >&2
  exit 1
fi
perl -0pi -e 's/#import "sqlite3\.h"/#import <ExpoSQLite\/sqlite3.h>/' "$expo_sqlite_umbrella"

if ! grep -q '#import <ExpoSQLite/sqlite3.h>' "$expo_sqlite_umbrella"; then
  echo "Could not qualify Expo SQLite's generated header import." >&2
  exit 1
fi

echo "Building, signing, installing, and launching WhereHouse on a connected iPhone."
echo "Keep ./dev.sh running in another terminal so the phone can reach the API."
corepack pnpm --filter @wherehouse/mobile exec expo run:ios \
  --device \
  --no-install \
  --no-build-cache \
  "$@"
