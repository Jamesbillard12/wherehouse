# ADR 0010: Workspace is the top-level inventory boundary

- **Status:** Accepted
- **Date:** 2026-09-02

## Decision

The domain calls the top-level inventory environment a `Workspace`. A user receives access through a
`WorkspaceMembership` with the existing owner or borrower role. Every current workspace has type
`household`; the enum is intentionally closed to implemented product behavior. School, business,
nonprofit, and other types are future product work, not hidden current capabilities.

Areas, items, physical identifiers, app instances, devices, and pairing sessions directly reference a
workspace. Zones, containers, and placements inherit the workspace through their owning area/item and
do not duplicate the foreign key. User accounts and user sessions remain global/user-scoped.

Household remains the presentation term for household-type workspaces. Web and mobile maintain one
active workspace identity internally and render household vocabulary through the presentation layer.

## Migration and compatibility

Migration `0013_workspace_model` renames the authoritative tables and foreign-key columns in place,
preserving UUIDs and relationships, and adds `workspace_type=household` to every existing row. It does
not create a parallel source of truth. Its downgrade reverses the names and removes the type only after
restoring the old schema.

API v1 exposes canonical `/workspaces` routes and workspace fields. Hidden `/households` route aliases,
computed legacy response fields, and deprecated API-client exports keep existing v1 clients operating.
They are transitional and should be removed only in a future versioned API after supported clients use
the workspace contract. Mobile renames legacy SQLite scope columns at startup and upgrades cache keys to
include `workspace_id`; secure pairing records and web selection storage are normalized in place.

Device credentials are bound to the workspace in which they were paired. A user's membership in another
workspace does not broaden that credential. Pairing is required for that other workspace.

Full-instance backups remain full-instance because that is the current deployment contract. Their
manifest enumerates each workspace ID and type; restore remains exact-schema, clean-instance restore.
