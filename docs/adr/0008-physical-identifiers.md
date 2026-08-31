# ADR-0008: Reusable physical identifiers

- **Status:** Accepted
- **Date:** 2026-08-31

## Context

Items and containers expose generated human-readable codes and a QR/NFC preference, while QR
payload construction and scan routing were implemented independently in clients. NFC needs the same
resolution behavior plus a safe write-and-verify workflow.

## Decision

Represent QR and NFC bindings as first-class `PhysicalIdentifier` records. Each contains an opaque
public ID, household, semantic target, medium, lifecycle status, and payload version. NFC identifiers
remain pending until the client confirms a successful write and read-back. Payloads use
`wherehouse://identify/v1/{publicId}` and never contain internal UUIDs or inventory data. Existing
item and container codes remain human-readable compatibility identifiers.

Application capabilities create and resolve identifiers. REST, QR, NFC, manual entry, and future
adapters invoke those capabilities. Resolution requires household authorization. Mobile NFC writes
use an NDEF URI record and read it back before reporting success.

## Consequences

Entities can acquire identifiers without embedding hardware behavior in inventory logic. QR and NFC
share resolution and can support replacement and revocation independently. NFC requires an Expo
development/native build rather than Expo Go.
