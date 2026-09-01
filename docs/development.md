# Development

## Requirements

- Node.js 22+
- pnpm via Corepack
- Python 3.13+
- uv
- Docker / Docker Compose

## Web

```bash
corepack enable
pnpm install
pnpm dev:web
```

The web app runs on `http://localhost:5173` and proxies `/api` requests to the local FastAPI server.

Run the web interaction tests with:

```bash
pnpm --filter @wherehouse/web test
```

New low-level web primitives are managed as owned source with the shadcn CLI. Run component commands
from `apps/web`, or pass `-c apps/web` from the repository root. The pinned Base UI and theme choices
are recorded in `apps/web/components.json`.

The root `./dev.sh` command combines PostgreSQL startup, migrations, the API, and the web app for
normal development. It binds the API to all local interfaces and uses the detected LAN address for
companion pairing. The phone and development computer must be on the same network. See the root
README for all convenience commands.

## API

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

The API runs on `http://localhost:8000`. OpenAPI is available at `/api/openapi.json` and interactive docs at `/api/docs`.

## Mobile

```bash
pnpm dev:mobile
```

The companion app will use SQLite for its offline replica/cache and SecureStore for device credentials.

For a Simulator build, keep `./dev.sh` running in another terminal and run:

```bash
./ios-simulator.sh
```

For a connected physical iPhone, run:

```bash
./ios-device.sh
```

The device script contains the physical-build setup: it selects a connected device, refreshes
CocoaPods, qualifies Expo SQLite's generated `sqlite3.h` import, clears native build products,
builds and signs with Xcode, installs the app, and starts Metro. The qualified import prevents Xcode
from substituting Apple's SQLite module after a Simulator build. Both scripts pass extra arguments
through to Expo.

After installing JavaScript dependencies from scratch or changing a native Expo dependency, refresh
the checked-in iOS workspace before building it in Xcode:

```bash
cd apps/mobile/ios
pod install
```

Open `WhereHouseCompanion.xcworkspace`, not the `.xcodeproj`. Expo SQLite copies its vendored
`sqlite3.c` and `sqlite3.h` sources into place while CocoaPods evaluates its podspec, so an Xcode
build immediately after replacing `node_modules` can otherwise report missing SQLite inputs.

## PostgreSQL only

For local development, PostgreSQL can be started independently with Docker Compose while the API and clients run directly on the host.
