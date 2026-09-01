# Authentication, devices, and pairing

WhereHouse uses opaque bearer credentials. Only SHA-256 hashes of session, pairing, and device
tokens are stored by the server. User passwords are salted and hashed with scrypt.

## User authentication

1. `POST /api/v1/auth/register` creates a user and returns a short-lived user session.
2. `POST /api/v1/auth/login` returns a new user session.
3. Send `Authorization: Bearer <access_token>` to authenticated endpoints.
4. `POST /api/v1/auth/logout` revokes the current user session.

Creating a household automatically makes the authenticated user its owner. Core inventory routes
require membership in the selected household. Owner access is required to pair or revoke devices.

## Companion pairing

1. An authenticated owner calls `POST /api/v1/households/{id}/pairing-sessions`.
2. The response includes a `wherehouse://pair` URI suitable for a QR code. The token expires after
   ten minutes by default and can be consumed only once.
3. The companion sends the token and its device identity to `POST /api/v1/pairing/consume`.
4. The response contains the server URL, household/user/instance IDs, and a revocable device bearer
   credential.

The companion must store the server URL, identifiers, and credential in Expo SecureStore. It must
not store credentials in the SQLite replica. SQLite continues to hold cached domain records and
pending offline operations. A device registration remains household-scoped for auditing and
revocation, while its credential represents the paired user and may select any household where that
user has a current membership. Every request still checks membership, and administrative operations
still check owner status in the target household. Credentials remain valid while offline and are
presented when queued operations synchronize.

`PUBLIC_BASE_URL` must be the URL reachable by the companion. Self-hosted deployments may use a
LAN or HTTPS URL; cloud deployments should use their public HTTPS API URL.
