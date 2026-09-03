# Settings and household selection

Settings is a product feature shared by the web and mobile clients through API contracts, not shared UI.
Both clients expose Account, Households, Preferences, Data & Privacy, and About. Web routes use
`/settings/{section}`; mobile uses the existing More tab.

Web additionally owns instance-scoped Backup & Restore management: Dropbox connect/reauthorize,
disconnect, status, manual backup, last success, and restore guidance. Mobile More shows concise
instance-scoped remote-backup status and last success, but intentionally has no Dropbox OAuth or
server-filesystem configuration. Both use the provider-neutral `/api/v1/backups/status` contract;
neither queries Dropbox directly or receives provider credentials.

Settings values have explicit scope:

| Scope | Current values and behavior |
| --- | --- |
| User | Identity, email, memberships, and sign-out |
| Workspace | Active inventory context, membership role, and connected devices |
| Device | Device credential, registration, active/revoked state, and last-seen time |
| Local only | Last selected household and browser/mobile presentation preferences |

The mobile active workspace is persisted with its secure pairing record while the UI labels it a
household. SQLite inventory, recent-location, and pending-operation records are keyed by workspace ID.
Changing a paired connection clears in-memory inventory and editing/location state, then loads only
that workspace's cache. Pending operations retain their original workspace ID and are never replayed
against another connection.

The regular mobile Scan QR action recognizes `wherehouse://pair` links in addition to inventory
identifiers. A pairing scan uses the existing one-time pairing capability, activates the paired
household, clears in-memory household state, and starts that household's normal cache reconciliation.

A paired device credential authorizes only its paired workspace, even if the user belongs to others.
Workspace membership is still checked for every capability, and owner-only operations require the
owner role in that workspace. Accessing another household from mobile requires an explicit pairing for
that workspace rather than reusing a credential with broader authority.

The secure pairing record preserves the paired workspace. Targeted revocation must match both device
and workspace, preventing a delayed event from an older pairing from disconnecting a newly paired
identity. On revocation, mobile quarantines the token, clears protected in-memory state, retains
workspace-scoped cached/queued data, and presents an explicit re-pair action.

Connected-device administration lives under the selected household. It is intentionally absent from
Overview and is not a top-level mobile category. Future AI, MCP, assistant, integration, and spatial
settings are not exposed until their underlying features exist.

Profile editing, password changes, account deletion, household renaming/removal, member invitations
and role management, export, session management, explicit themes, and cache clearing remain deferred
until their application capabilities and product semantics are implemented.
