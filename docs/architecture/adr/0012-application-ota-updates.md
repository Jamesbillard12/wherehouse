# ADR 0012: Host-controlled signed application OTA updates

- Status: accepted
- Date: 2026-09-03

## Decision

WhereHouse application releases are signed manifests plus ARM64 Docker image archives. A root-owned
host service extends `wherehouse-ops`; it alone downloads releases, verifies the configured publisher
public key and SHA-256, creates the pre-update backup, loads/tags images, migrates, restarts, checks
HTTP health, and records the result. The API talks to it through a three-command Unix socket
(`status`, `check`, `install`). The API receives neither the Docker socket nor the host filesystem.

The source is the trusted HTTPS manifest URL provisioned into the image. Clients cannot supply URLs,
versions, paths, commands, or release channels. Stable is the only supported channel. RSA-SHA256 is
the v1 signature algorithm; the private key stays in the release environment and only its public key
is embedded in an OTA-enabled appliance.

Application and appliance-image versions are independent after the first OTA. Application OTA covers
API/web images, migrations, and compatible Compose configuration. OS, firmware, kernel, bootloader,
Docker, and system packages require a future separate appliance mechanism.

OTA-enabled image builds require the manifest URL and publisher public key as one complete trust
configuration; intentionally offline images use an explicit disabled mode. The updater starts before
the application and preserves its runtime directory across restarts so the API bind mount cannot
retain an orphaned socket directory. Persistent installed-version metadata remains authoritative
independently of updater liveness.

Production artifacts are immutable GitHub Release assets produced from an existing `vX.Y.Z` tag on a
GitHub-hosted Ubuntu 24.04 ARM64 runner; no Raspberry Pi or self-hosted Actions runner is required.
The signing private key exists only as a protected release-environment secret and is materialized in
temporary runner storage only for the build; the public verification key is embedded in the
appliance. Tag-derived version injection is the canonical version source for manifest, container
images, API, web bundle, and installed marker.

## Safety and limitations

The host uses an advisory lifecycle lock, temporary downloads followed by atomic rename, signed
schema validation, exact size/hash checks, atomic status/version writes, and retention of the three
newest releases while protecting active/in-progress releases. Startup converts an interrupted phase
into an explicit failed state and removes partial downloads.

Container tags are restored after migration/startup/health failure. Database migrations may be
irreversible, so this is not a database rollback. The verified pre-update backup is retained and the
operator must use the documented clean restore procedure if the previous application cannot use the
migrated schema.
