# WhereHouse MVP

> Know what you have. Know where it is.

The first usable release lets a household reliably record possessions, organize them in real
locations, identify and find them later, move them while standing near them, and recover the data.
Reliability, low-friction mobile entry, findability, offline correctness, and safe operation take
priority over feature breadth.

See the [execution plan](mvp-execution-plan.md) for repository-derived status and the [release
checklist](mvp-release-checklist.md) for validation. Code existing is not the same as release
validation complete.

## MVP user-facing capabilities

- Account and household: register, log in, restore a session, log out, create and switch households,
  manage basic settings, pair mobile, and forget or revoke paired clients where supported.
- Locations: create and edit areas, zones, and containers; nest containers without cycles; show
  parent/child relationships, capacity state, contents, and readable paths.
- Items: create, edit, archive, photograph, quantify, place, move, and display a resolved path such
  as `Garage > North Wall > Shelving Unit > Yellow Bin`.
- Mobile-first entry: camera/library photos, quantity, recent/location selection, scan-first entry,
  add-another, and supported optimistic/offline behavior. Mobile is a primary client, not a viewer.
- Search: useful partial matching across name and available descriptive metadata, with a clear
  resolved location. AI or semantic search is not required.
- Physical identification: the common physical-identifier model, QR generation/printing/scanning,
  item/container resolution, and documented NFC registration/read/write/verify/lifecycle flows.
  Supported claims require separate physical iOS and Android evidence.
- Offline and sync: cached inventory/locations, offline browsing, queued supported mutations,
  versioned stable operation IDs, idempotent replay, reconnect/realtime reconciliation, and no
  retry-created duplicates.
- Data safety and operation: a tested backup and restore containing the database and intended media,
  plus a documented clean install, migration, restart, reboot, and upgrade path for the supported
  Raspberry Pi deployment.

The current Area/Zone/Container model is acceptable for MVP. A unified arbitrary-depth location
model is not a release prerequisite; stable IDs and a data-preserving migration path are.
Categories/tags, checkout/return, and durable movement history are early post-MVP unless later
implementation evidence justifies reconsideration.

## MVP architectural foundations

MVP work must establish reusable application capabilities behind thin transports, framework-neutral
actor context, reusable confirmation semantics, stable IDs, reusable idempotency, versioned
contracts, provider-neutral storage/backup boundaries, and capability-owned transaction/event
semantics as workflows are changed. Authorization must be able to evolve toward integration scopes
without building enterprise RBAC now.

The decision test is:

> If WhereHouse later needs to expose this operation through the web app, mobile app, MCP, a smart
> assistant, AI orchestration, generative UI, automation, or another client, can the core behavior
> be reused without duplicating business rules?

If not, improve the application/domain boundary while doing the relevant work. If yes, do not build
the future adapter early. Realtime events synchronize clients; they are not an audit log. Minimal
attribution persistence should land before any third-party, AI, MCP, assistant, or automated writes.

## Post-MVP implementations

- AI recognition, extraction, placement recommendations, semantic/natural-language search,
  summaries, and learned suggestions.
- MCP server/tools/resources and remote MCP; Alexa, Siri/App Intents, Google Assistant, ChatGPT, and
  successor adapters; automation and predictive workflows.
- Controlled generative UI producer/runtime/renderers. It may use only a versioned semantic registry,
  never arbitrary generated React or React Native; authored UI remains complete.
- Unified locations when required; geometry, LiDAR/RoomPlan, scanning, digital twins, spatial
  anchors, 3D, AR finding, capacity/fit intelligence, and packing optimization.
- Rich categories/tags, checkout/return, movement/activity history, advanced member roles and backup
  providers/retention; improved appliance packaging.
- Kubernetes, microservices, enterprise SSO/MDM/RBAC, generic workflow engines, and external brokers
  only when concrete scale or consumer needs exist.

## MVP non-goals

MVP requires no AI provider, MCP server, assistant adapter, generative UI runtime, 3D/AR or automatic
spatial reasoning, advanced recommendations, Kubernetes/microservices/broker, provider-specific
backup design, every cloud backup provider, Homebrew package, or prebuilt Pi image. Architectural
readiness for several of these remains part of MVP.

## Primary acceptance workflow

1. Cleanly install/start WhereHouse; register and create a household.
2. Create `Garage`, `North Wall`, a shelving unit, and a nested bin.
3. Generate and print the bin's QR label; pair a phone and scan it.
4. From mobile, add a photographed item with quantity into the bin; optionally register NFC.
5. Later search for it, see its full resolved location, scan/open it, and move it.
6. Disconnect mobile, perform a supported offline mutation, restart/reopen if applicable, reconnect,
   and prove the operation executes once and web/mobile converge.
7. Restart the server and prove the data persists.
8. Back up the installation, restore into a clean/test environment, and verify household data,
   items, quantities, hierarchy, identifiers, and intended photos/media.

Failure of this workflow is an MVP blocker. Missing post-MVP intelligence or interface adapters is not.
