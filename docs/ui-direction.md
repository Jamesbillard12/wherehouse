# WhereHouse UI Direction

This document records the intended product experience for the WhereHouse web and companion
applications. The reference mockup is a product-direction artifact, not a claim that every screen
or feature shown has been implemented.

![WhereHouse web and companion UI direction](../assets/ChatGPT%20Image%20Aug%2026%2C%202026%2C%2008_44_20%20PM.png)

## Experience principles

- Make the item's exact location the most important piece of information after its name.
- Optimize the companion for quick, one-handed, scan-first workflows.
- Optimize the web app for setup, browsing, bulk management, and household-wide visibility.
- Keep common actions shallow: scan, add, find, move, transfer, check out, and return.
- Show sync and offline state clearly without making connectivity the center of the experience.
- Use AI to propose item data, while keeping user confirmation explicit and canonical.
- Preserve recognizable household language and hierarchy: area, zone, container, item.

## Shared visual language

- Clean, light surfaces with restrained borders and subtle elevation.
- Dark navy for the primary brand and navigation structure.
- Green for successful, available, confirmed, and primary companion actions.
- Indigo or blue for selected navigation and secondary web actions.
- Orange and red only for warnings, capacity problems, overdue items, and destructive actions.
- Compact cards, clear typography, rounded controls, and simple line icons.
- Item photography and human-readable location paths should carry more visual weight than IDs.

Exact colors, fonts, spacing, and iconography remain implementation details to be formalized as
reusable design tokens. Accessibility, contrast, dynamic text, keyboard navigation, and responsive
behavior take precedence over pixel-for-pixel reproduction of the mockup.

## Web app

The web app is the household administration and overview surface. Its persistent navigation should
provide access to:

- Dashboard
- Items
- Containers
- Locations
- Activity
- Transfers
- Checkouts
- Contacts
- Reports
- Settings

The dashboard direction includes:

- A household switcher and global search.
- Summary cards for items, containers, locations, and checked-out inventory.
- A browsable location tree that exposes nested storage structure.
- Recently added items with thumbnails and resolved location paths.
- Recent activity covering additions, movement, checkout, and return.
- Prominent entry points for transfers, AI-assisted item capture, and printable labels.
- A visible sync/server status indicator.

The web application should remain responsive, but dense household management is primarily designed
for a desktop-sized viewport.

## Companion app

The companion is the operational surface used while standing near the inventory. Its home screen
should prioritize four actions:

1. Scan
2. Add item
3. Find item
4. Transfer

Recent activity provides confirmation and continuity beneath those actions. Persistent navigation
should keep Home, Items, Scan, Checkouts, and More readily available, with Scan receiving the
strongest emphasis.

### Key companion screens

#### QR scanning

- Use a full-screen camera with a clear framing guide.
- Accept QR labels for supported WhereHouse entities.
- Provide light, manual code entry, and scan history as recovery paths.
- Give immediate feedback when a code is invalid or cannot be resolved offline.

#### Items list and item detail

- Support search and filtering from the list.
- Show a thumbnail, item name, and compact resolved location path in each result.
- Show photo, category/tags, quantity, condition, notes, and exact location on detail.
- Keep Edit and Move as direct actions from item detail.

#### AI-assisted item capture

- Lead with the captured photo.
- Present AI-proposed name, category, brand, quantity, and tags as editable fields.
- Distinguish proposed values from confirmed values.
- Require user confirmation before saving canonical inventory data.

#### Item placement

- Present locations as an expandable area, zone, and container hierarchy.
- Show container capacity or out-of-space state before confirmation.
- Keep the selected destination obvious and require an explicit confirmation.

#### Transfers

- Make source and destination visible before item selection.
- Support transferring multiple items and quantities in one workflow.
- Keep transfer separate from checkout: transfer changes location; checkout changes custody.

#### Checkout and return

- Show the item and current location at the top of the workflow.
- Capture recipient, quantity where applicable, expected return date, and notes.
- Support both household users and the MVP's permitted borrower model.
- Preserve checkout history rather than replacing it with a current-state boolean.

## Location presentation

Location paths should be human-readable and consistent across clients. For example:

`Garage > North Wall > Shelving Unit > Bin N-03`

The interface may collapse intermediate levels when space is limited, but it must provide a way to
reveal the complete resolved path. Relationship semantics such as `in`, `on`, `under`, and
`attached_to` should be retained when they materially clarify placement.

## Offline and sync states

The companion must remain useful without connectivity. UI states should distinguish:

- Synced
- Changes waiting to sync
- Sync in progress
- Conflict requiring review
- Server unavailable

Offline-created and edited records should remain usable locally. Physical-location conflicts must
be surfaced instead of silently overwriting another change.

## Scope and sequencing

The mockup includes both MVP and post-foundation concepts. Implementation should follow the MVP and
architecture documents rather than attempting the entire composition at once.

Suggested sequence:

1. Authentication, household onboarding, and device pairing.
2. Shared navigation, household selection, and responsive application shells.
3. Location browsing, items, containers, search, and resolved location paths.
4. QR identifiers, scanning, and printable labels.
5. Offline cache and pending-operation status.
6. AI-assisted item capture and placement.
7. Transfers, checkout, and return.
8. Activity, contacts, reports, and richer dashboard insights as their domain support arrives.

Features shown in the reference should not bypass documented authorization, offline-first, history,
or domain-model rules for the sake of visual fidelity.
