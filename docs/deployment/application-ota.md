# Application OTA operations

## Build and publish

Production releases are immutable GitHub Release assets built by
`.github/workflows/application-release.yml` from a `vX.Y.Z` tag. The protected
`appliance-release` GitHub environment must contain `WHEREHOUSE_RELEASE_SIGNING_KEY_PEM`. The workflow
fails clearly when it is absent, materializes it only in runner temporary storage with owner-only
permissions, signs the manifest, derives the public key, and verifies the signature before publishing.

Generate a 3072-bit RSA key offline, store the private PEM as that protected environment secret, and
distribute only its public key in appliance images:

```sh
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out release-private.pem
openssl pkey -in release-private.pem -pubout -out deploy/raspberry-pi/update-public-key.pem
```

Keep an encrypted offline recovery copy and restrict release-environment approval. Never put the
private key in Git, logs, workflow artifacts, releases, or appliances. Rotation requires shipping an
appliance trust update before signing solely with the new key; losing the only trusted key prevents
normal OTA and requires a separately authenticated recovery/image path.

For local testing only, build a patch release (or pass `0.2.0`) without publishing:

```sh
WHEREHOUSE_RELEASE_SIGNING_KEY=/secure/release-private.pem \
WHEREHOUSE_RELEASE_BASE_URL=https://releases.example/wherehouse/0.1.6/ \
WHEREHOUSE_RELEASE_NOTES='Reliability fixes.' \
./build-release.sh next
```

The command builds API/web for `linux/arm64`, injects the release version into both applications, and
writes `dist/releases/<version>/release.json`,
`release.json.sig`, a versioned runtime tar, and SHA-256 file. Publish all four files without modifying
them, then atomically update the configured stable `release.json` and `release.json.sig`. Its
`runtimeUrl` remains the immutable versioned artifact URL. SHA-256 detects corruption; the signature
authenticates the configured publisher key. Production appliances use
`https://github.com/Jamesbillard12/wherehouse/releases/latest/download/release.json`; its redirect is
discovery-only and the signed manifest points to the immutable tag-specific runtime asset. Existing
release assets are never overwritten.

The manifest declares minimum appliance/current-application versions, a schema revision range, and
the required `expand-contract` migration policy. Downgrades are rejected. OTA-compatible migrations
must expand first, keep the previous application usable, and contract only in a later release after
that application is no longer a rollback target.
For a controlled physical rollback drill only, set
`WHEREHOUSE_RELEASE_VALIDATION_SCENARIO=fail-health`; this value is covered by the manifest signature
and makes the host updater enter its normal rollback path after actual API/web health checks.

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

Emergency console checks use the same host implementation as the UI:

```sh
sudo /opt/wherehouse/deploy/raspberry-pi/wherehouse-ops update-status
sudo /opt/wherehouse/deploy/raspberry-pi/wherehouse-ops update-check
sudo /opt/wherehouse/deploy/raspberry-pi/wherehouse-ops update
sudo systemctl restart wherehouse-update.service
sudo journalctl -u wherehouse-update.service -n 200 --no-pager
```

Restarting `wherehouse-update.service` runs interruption recovery, removes partial downloads, and
preserves a visible failed state for diagnosis/retry. Database recovery deliberately reuses the
documented verified-backup restore flow rather than attempting an unsafe automatic downgrade.

## Failure and recovery

Invalid manifests, signatures, architecture, channel, appliance compatibility, size, and checksum are
rejected before install. A migration/startup/health failure restores previous application image tags
and restarts them. This does not reverse database migrations. Preserve the pre-update backup and, when
schema compatibility prevents startup, follow the clean restore procedure in
[Backup and restore](backup-and-restore.md). Host logs contain diagnostics; clients receive a sanitized
service-unavailable error.

Application OTA replaces only the API/web container images. PostgreSQL, uploads/media, instance
configuration and secrets, workspace/user/session/pairing state, primary-storage and SMB settings,
backup configuration, and Dropbox credentials remain in persistent appliance/system storage. It does
not update Raspberry Pi OS, kernel, firmware, bootloader, Docker/runtime, or the SD-card image.

## Physical acceptance (required)

On a Pi 4 running version N with real household, inventory, uploads, and realtime activity: publish
N+1; use only `http://wherehouse.local` Settings → System to discover and install it; do not reflash,
remove the SD card, SSH, SCP, or run Docker manually. Record signature/checksum verification, backup,
migration, container replacement, browser/realtime reconnection, N+1 reporting, and intact data/media.
Then publish one invalid/broken release and record safe rejection or image recovery. Finally reboot and
verify N+1, data, web, realtime, image tags, and non-stuck status. Automated tests do not complete these
rows.
