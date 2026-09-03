# Authentication, devices, and pairing

Users are global identities and gain inventory access through `WorkspaceMembership`. User sessions may
operate in any workspace where the user is a member. Device credentials are narrower: they remain bound
to the workspace selected during pairing, and membership elsewhere does not grant that device access.

WhereHouse uses opaque bearer credentials. Only SHA-256 hashes of session, pairing, and device
tokens are stored by the server. User passwords are salted and hashed with scrypt.

## User authentication

1. `POST /api/v1/auth/register` creates a user and returns a short-lived user session.
2. `POST /api/v1/auth/login` returns a new user session.
3. Send `Authorization: Bearer <access_token>` to authenticated endpoints.
4. `POST /api/v1/auth/logout` revokes the current user session.

Web session restoration validates the stored credential before rendering protected content. Invalid
or expired sessions clear the browser credential and selected-household preference and return to a
product-level sign-in recovery state.

Creating a workspace (presented as a household today) automatically makes the authenticated user its
owner. Core inventory routes require membership in the selected workspace. Owner access is required to
pair or revoke devices.

## Companion pairing

1. An authenticated owner calls `POST /api/v1/workspaces/{id}/pairing-sessions`; the v1 household
   route remains a deprecated compatibility alias.
2. The response includes a `wherehouse://pair` URI suitable for a QR code. The token expires after
   ten minutes by default and can be consumed only once.
3. The companion sends the token and its device identity to `POST /api/v1/pairing/consume`.
4. The response contains the server URL, workspace/user/instance IDs, and a revocable device bearer
   credential.

The companion must store the server URL, identifiers, and credential in Expo SecureStore. It must
not store credentials in the SQLite replica. SQLite continues to hold cached domain records and
pending offline operations. A device registration and credential remain workspace-scoped for
auditing, authorization, and revocation. The user's membership in another workspace does not extend the
credential. Credentials remain valid while offline and are presented when queued operations synchronize.

Device revocation is an idempotent application capability. It verifies owner membership, commits the
inactive/revoked state, and only then asks the realtime hub to notify and close sockets authenticated
by that device. REST requests and WebSocket reconnects always authenticate against current device
state, so the old credential remains invalid after re-pairing. The event contains workspace ID,
device ID, and revocation time, never a credential.

`PUBLIC_BASE_URL` must be the URL reachable by the companion. Self-hosted deployments may use a
LAN or HTTPS URL; cloud deployments should use their public HTTPS API URL.
