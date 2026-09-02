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
| Household | Active inventory context, membership role, and connected devices |
| Device | Device credential, registration, active/revoked state, and last-seen time |
| Local only | Last selected household and browser/mobile presentation preferences |

The mobile active household is persisted with its secure pairing record. SQLite inventory,
recent-location, and pending-operation records remain keyed by household ID. Switching first clears
in-memory inventory and editing/location state, persists the new household, then loads only that
household's cache before reconciling with the API. Pending operations retain their original household
ID and are never replayed against the newly selected household.

The regular mobile Scan QR action recognizes `wherehouse://pair` links in addition to inventory
identifiers. A pairing scan uses the existing one-time pairing capability, activates the paired
household, clears in-memory household state, and starts that household's normal cache reconciliation.

A paired device authenticates the user and may access any household in which that user has a current
membership. Household authorization is still checked for every capability, and owner-only operations
such as pairing and revoking devices still require an owner membership in the target household. A
device remains registered under the household through which it was originally paired for auditing and
revocation.

The secure pairing record also preserves that original pairing household while the active household
may change. Targeted revocation must match both the device and original pairing household, preventing
a delayed event from an older pairing from disconnecting a newly paired identity. On revocation,
mobile quarantines the token, clears protected in-memory state, retains household-scoped cached/queued
data, and presents an explicit re-pair action.

Connected-device administration lives under the selected household. It is intentionally absent from
Overview and is not a top-level mobile category. Future AI, MCP, assistant, integration, and spatial
settings are not exposed until their underlying features exist.

Profile editing, password changes, account deletion, household renaming/removal, member invitations
and role management, export, session management, explicit themes, and cache clearing remain deferred
until their application capabilities and product semantics are implemented.
