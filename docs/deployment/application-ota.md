# Application OTA operations

## Build and publish

Generate an RSA signing key in protected release infrastructure and distribute only its public key to
image builds. Build a patch release (or pass `0.2.0`) without building Raspberry Pi OS:

```sh
WHEREHOUSE_RELEASE_SIGNING_KEY=/secure/release-private.pem \
WHEREHOUSE_RELEASE_BASE_URL=https://releases.example/wherehouse/0.1.6/ \
WHEREHOUSE_RELEASE_NOTES='Reliability fixes.' \
./build-release.sh next
```

The command builds API/web for `linux/arm64` and writes `dist/releases/<version>/release.json`,
`release.json.sig`, a versioned runtime tar, and SHA-256 file. Publish all four files without modifying
them, then atomically update the configured stable `release.json` and `release.json.sig`. Its
`runtimeUrl` remains the immutable versioned artifact URL. SHA-256 detects corruption; the signature
authenticates the configured publisher key.

## Discovery and installation

`wherehouse-ops update-check`, `update-status`, and `update` are operator diagnostics. Normal users use
Settings → System. The API accepts no release URL or command arguments. Install locks against another
appliance lifecycle operation, validates compatibility, downloads to `.partial`, verifies size,
signature, and checksum, creates a verified backup, loads expected images, migrates, restarts, checks
API and web HTTP health, records the application version, and retains recent releases.

State phases are `idle`, `checking`, `available`, `downloading`, `verifying`, `backing_up`,
`installing`, `migrating`, `restarting`, `health_check`, `completed`, and `failed`. On host-service
restart, partial files are discarded and an unfinished state becomes `failed`; success is never
inferred from reboot alone.

## Failure and recovery

Invalid manifests, signatures, architecture, channel, appliance compatibility, size, and checksum are
rejected before install. A migration/startup/health failure restores previous application image tags
and restarts them. This does not reverse database migrations. Preserve the pre-update backup and, when
schema compatibility prevents startup, follow the clean restore procedure in
[Backup and restore](backup-and-restore.md). Host logs contain diagnostics; clients receive a sanitized
service-unavailable error.

## Physical acceptance (required)

On a Pi 4 running version N with real household, inventory, uploads, and realtime activity: publish
N+1; use only `http://wherehouse.local` Settings → System to discover and install it; do not reflash,
remove the SD card, SSH, SCP, or run Docker manually. Record signature/checksum verification, backup,
migration, container replacement, browser/realtime reconnection, N+1 reporting, and intact data/media.
Then publish one invalid/broken release and record safe rejection or image recovery. Finally reboot and
verify N+1, data, web, realtime, image tags, and non-stuck status. Automated tests do not complete these
rows.
