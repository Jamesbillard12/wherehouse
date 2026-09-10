# WhereHouse Domain Model

This document describes the current/MVP model. The proposed arbitrary-depth logical location model
and optional spatial extensions are documented in [ADR-0002](adr/0002-hierarchical-locations.md) and
[the spatial architecture](spatial-architecture.md). They are not implemented requirements today.

## Workspace and users

`Workspace` is the top-level inventory and authorization boundary. The current product creates only
`household` workspaces and the UI says “Household”; internal services and persistence do not assume that
label. Users join through `WorkspaceMembership` and may belong to multiple workspaces.

```text
User ↔ WorkspaceMembership ↔ Workspace
                                ├─ Area → Zone / Container → placements
                                ├─ Item
                                ├─ Device / PairingSession / AppInstance
                                └─ BorrowerProfile → Checkout
```

### Workspace
- id: UUID
- name: string
- workspaceType: household
- createdAt
- updatedAt

### User
- id: UUID
- email
- displayName
- createdAt
- updatedAt

### WorkspaceMembership
Associates a user with a workspace.

Roles:
- owner
- borrower

A user may be an owner in one workspace and a borrower in another.

## Locations

### Area
Major physical location such as Garage, Attic, Trailer, Shed, Workshop, Storage Unit, or Cabin.

Fields:
- id: UUID
- workspaceId: UUID
- name
- description?

### Zone
A recognizable section within an area, such as North Wall, Workbench, or Ceiling Storage.

Fields:
- id: UUID
- areaId: UUID
- name
- description?

## Containers

A container is anything capable of holding or supporting stored objects, including bins, boxes, shelves, shelving units, cabinets, drawers, racks, hooks, toolboxes, bags, cases, and workbenches.

### Container
- id: UUID
- areaId: UUID
- zoneId?: UUID
- name
- code?
- type
- description?
- isMovable
- isOutOfSpace
- isArchived
- createdAt
- updatedAt

`isOutOfSpace` is user-controlled in V1. Removing an item does not automatically clear it, but the app may prompt the user to reconsider the status.

### ContainerPlacement
Represents a relationship between containers.

- id: UUID
- containerId: UUID
- parentContainerId: UUID
- relationship: in | on | under | attached_to
- position?
- createdAt

Example: Camping Bin ON Shelf 3.

## Physical identifiers

`PhysicalIdentifier` binds an opaque, public, versioned identifier to an item or container and a
medium (`qr` or `nfc`). Identifiers have an independent pending/active/revoked lifecycle. QR and NFC encode
the same canonical payload and resolve through the same authorized capability; internal UUIDs and
inventory data are never encoded on the physical medium. See
[ADR-0008](adr/0008-physical-identifiers.md).

## Items

### Item
An item record represents one or more interchangeable objects stored together.

- id: UUID
- workspaceId: UUID
- name
- description?
- quantity
- unit?
- manufacturer?
- model?
- serialNumber?
- categoryId?: UUID
- notes?
- isArchived
- createdAt
- updatedAt

### ItemPlacement
- id: UUID
- itemId: UUID
- containerId?: UUID
- zoneId?: UUID
- relationship?: in | on | under | attached_to
- createdAt

The system can derive a full location through the container hierarchy.

The current model supports an `Area → optional Zone → nested Containers` path. Container nesting is
arbitrary-depth and cycle-protected by the API, but Area and Zone remain fixed concepts. Avoid adding
more fixed hierarchy levels while the first-class location proposal is evaluated.

### ItemPhoto
- id: UUID
- itemId: UUID
- storageKey
- isPrimary
- createdAt

## Categories and tags

### Category
- id: UUID
- workspaceId: UUID
- name

### Tag
- id: UUID
- workspaceId: UUID
- name

### ItemTag
- id: UUID
- itemId: UUID
- tagId: UUID

## AI

### ItemAIAnalysis
Stores AI proposals separately from canonical item data.

- id: UUID
- itemId?: UUID
- photoId: UUID
- proposedData: JSON
- rawResult: JSON
- model
- createdAt

AI should distinguish observed, inferred, and unknown values. AI proposes, while user-approved data becomes canonical.

### PlacementSuggestion
- id: UUID
- itemId: UUID
- suggestedContainerId: UUID
- score
- reason
- acceptedContainerId?: UUID
- wasAccepted?: boolean
- createdAt

Placement suggestions may consider similar items, categories, tags, hierarchy, past choices, and container space status.

## Checkouts

### BorrowerProfile

The stable workspace-scoped identity used by checkout history. A Managed Borrower has a display
name, optional email, and no linked user. Enabling self-service links that same profile to a `User`
and adds a borrower membership; it never replaces the profile or migrates history.

### BorrowerInvitation

An owner may create a short-lived, single-use, revocable invitation for a Managed Borrower with an
email. Only the token hash is persisted. Claiming links the existing profile and creates a device
owned by the borrower user.

### Checkout
Tracks whole-item custody rather than physical location. Partial-quantity loans are outside the current scope.

- id: UUID
- workspaceId: UUID
- itemId: UUID
- borrowerProfileId: UUID
- checkedOutByUserId: UUID
- checkedOutAt
- dueAt?
- returnedAt?
- returnedByUserId?: UUID
- checkoutNotes?
- returnNotes?

The borrower identifies who has the item; actor IDs identify who performed each action, and may
differ. Owners may act for every borrower. Linked borrowers may act only on their own loans. No
`isCheckedOut` boolean is stored on Item. A database constraint permits only one active checkout per item.

### CheckoutSession

A server-persisted checkout draft owned by one acting user in one workspace. Each user has at most
one active session per workspace, shared across that user's devices. Owners may view every active
workspace session but edit only their own; Self-Service Borrowers see and edit only their own.
Each session has one borrower, due date, note, revision, and multiple `CheckoutSessionItem` rows.

Adding an item is not a reservation, so the same item may appear in concurrent sessions. That is a
derived soft warning. Completing a session locks and validates its full item set, creates every
authoritative `Checkout` in one transaction, and completes the session. If any item is unavailable,
no checkout is created and the session remains intact. Revisions prevent stale device submission.

## Transfers

Transfers represent actual physical movement between locations.

### Transfer
- id: UUID
- workspaceId: UUID
- createdByUserId: UUID
- sourceAreaId?: UUID
- destinationAreaId?: UUID
- status: draft | in_progress | completed | cancelled
- startedAt?
- completedAt?
- notes?
- createdAt
- updatedAt

### TransferItem
- id: UUID
- transferId: UUID
- itemId: UUID
- quantity
- sourceContainerId?: UUID
- destinationContainerId?: UUID
- status: pending | moved | missing | skipped
- movedAt?

### TransferContainer
- id: UUID
- transferId: UUID
- containerId: UUID
- sourcePlacementId?: UUID
- destinationContainerId?: UUID
- destinationZoneId?: UUID
- status: pending | moved | skipped
- movedAt?

Items may retain a normal home while temporarily being located elsewhere.

## Activities and loadouts

### ActivityTemplate
Represents a recurring activity such as Camping Trip, Ski Weekend, Soccer Practice, Beach Day, or Christmas Setup.

- id: UUID
- workspaceId: UUID
- name
- description?
- defaultSourceAreaId?: UUID
- defaultDestinationAreaId?: UUID
- isArchived
- createdByUserId: UUID
- createdAt
- updatedAt

### ActivityRequirement
May reference a specific known inventory item/container or a generic requirement.

- id: UUID
- activityTemplateId: UUID
- itemId?: UUID
- containerId?: UUID
- name
- quantity?
- isRequired
- category?
- notes?
- createdAt

### ActivityTask
Represents non-inventory preparation work such as filling a water tank or charging a battery.

- id: UUID
- activityTemplateId: UUID
- name
- description?
- isRequired
- createdAt

### ActivityInstance
Represents a real occurrence of an activity.

- id: UUID
- activityTemplateId?: UUID
- workspaceId: UUID
- name
- startedAt?
- completedAt?
- createdByUserId: UUID
- createdAt

Activity instances can generate one or more transfers.

## Scanning

### ScannableIdentifier
- id: UUID
- entityType: item | container | user
- entityId: UUID
- identifierType: qr | barcode | nfc | upc | custom
- value
- isActive
- createdAt

Database UUIDs remain canonical. Printed/scanned identifiers are shorter opaque values.

## Pairing and devices

### AppInstance
Represents the server instance the companion app connects to.

- id: UUID
- workspaceId: UUID
- name
- baseUrl
- instanceType: local | cloud
- createdAt

### Device
- id: UUID
- workspaceId: UUID
- userId: UUID
- name
- type: phone | tablet | scanner | browser | other
- lastSeenAt?
- isActive
- createdAt
- revokedAt?

### PairingSession
- id: UUID
- workspaceId: UUID
- createdByUserId: UUID
- tokenHash
- expiresAt
- consumedAt?
- createdAt

Pairing tokens are short-lived and one-time-use. Raw pairing tokens should not be stored.
