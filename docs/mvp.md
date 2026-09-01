# WhereHouse MVP

## Goal

The MVP must let a household organize real items, find them later, move them, and use the phone when connectivity is unavailable.

## Included

- Household creation
- Owner users
- Basic borrower support
- Areas and zones
- Containers
- Nested container placement
- `isOutOfSpace` support
- Items and quantities
- Categories and tags
- Item photos
- Item placement
- QR identifiers
- QR label PDF generation
- React web app
- React Native companion app
- FastAPI backend
- PostgreSQL canonical database
- SQLite mobile cache
- Companion/server pairing
- Basic offline operation queue
- Search
- Basic AI item creation from photos
- Basic AI placement recommendation
- Checkouts and returns
- Simple transfers between areas such as Garage -> Trailer
- Raspberry Pi deployment
- Cloud deployment using the same API

## Explicitly deferred

- Activity templates and camping checklists
- Learned transfer suggestions
- Weather-aware suggestions
- External contacts without accounts
- Advanced NFC provisioning and bulk-management workflows
- Scanner-gun-specific UI
- Advanced conflict resolution
- Visual garage maps
- Purchase and warranty tracking
- Insurance reports
- Automated capacity estimation
- Advanced AI learning from user corrections

## Primary success workflow

1. Create a household.
2. Create Garage.
3. Create North Wall zone.
4. Create Shelf.
5. Create Bin.
6. Print the bin QR label.
7. Scan the bin from the companion app.
8. Photograph an item.
9. AI proposes item details.
10. Review and save the item into the bin.
11. Search for the item later.
12. See its full resolved location.
13. Scan and move it to another area such as Trailer.
14. Return it to its normal home.
15. Check an item out to another user and later check it back in.

## MVP architecture

Keep the MVP as a modular monolith:

- one FastAPI service
- one PostgreSQL database
- one React SPA
- one Expo/React Native app
- one SQLite mobile cache
- Docker Compose for self-hosting

No microservices, event bus, Kubernetes, or unnecessary distributed infrastructure.

## Core product principle

Entering inventory must feel easier than losing track of inventory. If cataloging the garage feels like more work than the organization itself, the MVP has failed.
