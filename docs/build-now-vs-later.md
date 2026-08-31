# Build now vs. later

## Do now, incrementally

| Foundation | Current evidence | Next action |
| --- | --- | --- |
| Application capabilities | Mutations, commits, and events are in REST routes | Extract the next materially changed item/location use case behind a tested capability; do not bulk-rewrite routes |
| Stable IDs | UUID primary keys exist; public item/container codes exist | Preserve UUIDs; document ID/code semantics and model identifiers separately when multiple codes/providers arrive |
| Hierarchical location | Containers nest with cycle prevention, but Area/Zone is fixed | Keep MVP model; design and test a migration to a first-class arbitrary location tree before spatial work |
| Shared contracts | Web/mobile share the TypeScript client | Add OpenAPI generation/parity checks before another external client is released |
| Authorization context | Principal has user, method, optional device/household | Define framework-neutral actor context and capability scopes while extracting capabilities |
| Auditability | Realtime includes source but is ephemeral | Add append-only audits before AI/MCP/third-party mutations, not for speculative reads |
| Offline correctness | SQLite cache and limited queued item writes exist | Add idempotency, revisions, conflicts, and operation schema version as queued operations expand |
| Events | Realtime invalidation has current consumers | Move publication into capabilities; add an in-process dispatcher, not a broker |
| Documentation | Current architecture/domain docs exist | Keep them current and record consequential decisions in ADRs |

Use an evolutionary pattern: route → capability → repository port/implementation. Start with
`MoveItem` or the next feature touching placement, because location integrity, authorization,
transactionality, realtime publication, audit, offline replay, and future MCP all meet there.

## Prepare only when a near-term consumer exists

- Create a unified `Location` tree and migration once product semantics and backward compatibility
  are agreed; do not add parallel empty tables now.
- Add typed domain/application events when capabilities are extracted; add an outbox only for a
  durable consumer.
- Add permission scopes when issuing the first integration credential.
- Create `packages/ui-schema` with the first generative renderer/prototype.
- Create an MCP service with the first approved MCP use cases.
- Add optional dimensions/capacity tables when manual capture or storage recommendations are being
  built; normalize values and units then.
- Add spatial scan, anchor, and geometry storage with the first scanning proof of concept.

## Explicitly deferred

- Full MCP server and remote MCP hosting
- Generative UI planner/engine and runtime-generated frontend code
- Alexa skills, Siri/App Intents, and Google Assistant integrations
- Local or cloud LLM orchestration as a required path
- RoomPlan/LiDAR/depth scanning, object detection, and scan reconstruction
- 3D digital-twin editor and production WebGL/WebGPU viewer
- AR item-finding and persistent device localization
- Automatic spatial capacity, fit, weight, consolidation, or occupancy optimization
- Cloud/local multi-instance synchronization
- Microservices, Kafka/Redis event infrastructure, Kubernetes, or a generic workflow engine

These are deferred because they have no current product consumer or validated data model. Core
inventory, QR workflows, search, hierarchy, and reliable offline behavior should mature first.

## Decision gates

Owner input is required before:

1. Choosing whether Area and Zone migrate into a unified Location table or remain compatibility
   projections over it.
2. Defining container semantics: every physical holder as a location node, or a distinct entity that
   may be placed at a location. The spatial model recommends distinct concepts with a shared locator.
3. Choosing conflict behavior and offline authority for concurrently moved items.
4. Selecting first MCP clients/deployment mode and the default confirmation policy.
5. Selecting scan providers/rendering technology after a device and browser proof of concept.
6. Deciding retention and visibility of audit records and AI interaction metadata.
