# Build now vs. later

This document is a scope guard. [MVP](mvp.md) is canonical for release scope; the [execution
plan](mvp-execution-plan.md) orders the work; the [roadmap](roadmap.md) describes longer-term evolution.

| Build or harden for MVP | Preserve now; implement later |
| --- | --- |
| Reliable account, household, inventory, location, search, mobile entry, identifiers, offline sync, backup/restore, and Pi operation | AI, MCP, assistants, automation, generative UI, 3D/AR, advanced recommendations |
| Capabilities, actor context, authorization boundary, reusable confirmation/idempotency, stable IDs, versioned contracts | Actual integration credentials/scopes, large audit UI, durable broker/workflow platform |
| Current Area/Zone/Container model plus cycle safety and migration compatibility | Unified arbitrary-depth location migration and spatial extensions |
| Provider-neutral backup semantics with local/external-SSD and Dropbox as the first remote adapter | NAS, SMB/NFS, S3, B2, OneDrive, Google Drive providers and rich retention UI |
| Modular monolith and in-process realtime publication for current consumers | Microservices, Kubernetes, external event brokers, fleet management |

Do not create empty abstractions solely to reserve names. Add a boundary when a current consumer or
materially changed workflow needs it. Categories/tags, checkout/return, and historical movement views
are early post-MVP because the current repository does not substantially implement them.
