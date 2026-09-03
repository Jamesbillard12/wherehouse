# Raspberry Pi appliance implementation

This directory packages the canonical Docker Compose deployment into model-specific Raspberry Pi OS
Lite 64-bit images for Pi 4 and Pi 5. Separate images follow `rpi-image-gen`'s hardware device layers;
both support SD and USB boot media supported by the selected Pi firmware. Pi 4 NVMe is not claimed by
the upstream `rpi4` image layer.

## Build a release image

Apple Silicon macOS with Docker Desktop installed and running is a supported image build host. The
script starts a privileged `linux/arm64` Debian container, fetches pinned `rpi-image-gen` v2.6.0 in
the builder image, and keeps Linux-only dependencies off macOS. No Raspberry Pi or manual
`rpi-image-gen` clone is required.

```sh
./deploy/raspberry-pi/image/build-image.sh 0.1.0 pi5
# or
./deploy/raspberry-pi/image/build-image.sh 0.1.0 pi4
```

The build verifies Docker/host architecture, refuses unsupported devices and dirty trees, embeds the
committed snapshot, and builds every application dependency inside Linux ARM64. Docker BuildKit,
named apt, and `rpi-image-gen` package-cache volumes speed later builds without caching final images.
Set `RPI_IMAGE_GEN_VERSION` only when deliberately testing another pinned release; the supported
default is declared once in `build-image.sh` and passed into the Docker build.

Outputs are `dist/pi/wherehouse-pi5-0.1.0.img.xz` (or Pi 4), its `.sha256`, and `.json`, plus the
separately checksummed application-update runtime tar. The JSON records product/app/build/generator,
device, architecture, base OS, and hardware metadata. No finished image is manually edited.

Verify the compressed artifact on macOS, then choose it in Raspberry Pi Imager through
**Choose OS → Use custom**:

```sh
cd dist/pi
shasum -a 256 -c wherehouse-pi5-0.1.0.img.xz.sha256
```

The Docker container requires `--privileged` because `rpi-image-gen` builds filesystems using mount
namespaces. It mounts the Docker Desktop socket so backend/web/PostgreSQL images are built/saved as
Linux ARM64 rather than copying macOS binaries. The generated `.img.xz` remains a normal
`image-rpios` disk image accepted by Raspberry Pi Imager. Image generation and boot remain not run in
this repository's evidence because Docker was unavailable in the implementation workspace.

## First boot and lifecycle

`wherehouse.service` creates `/var/lib/wherehouse`, generates a UUID, database password, and app
secret with OS entropy, persists them mode `0600`, loads embedded containers once, validates storage,
and starts the canonical Compose dependency chain. It never creates a user or workspace. Reboots
validate and reuse the same state.

```sh
sudo systemctl status wherehouse
sudo journalctl -u wherehouse -b
curl http://localhost/api/v1/system/status
sudo systemctl restart wherehouse
sudo /opt/wherehouse/deploy/raspberry-pi/wherehouse-backup create local
```

Avahi publishes `<hostname>.local`, which defaults to `wherehouse.local`. When `.local` is unavailable
on a VLAN or unsupported client, use the Pi's DHCP address. SSH is disabled by default.

### Raspberry Pi Imager customization limitation

Use Ethernet for initial physical validation. Standard Wi-Fi/hostname/SSH/locale/timezone customization
is **not currently supported or validated** when this Trixie `.img.xz` is selected with **Use custom**.
Raspberry Pi Imager 2.x treats a standalone local image as `init_format: none` unless it is supplied
through an OS manifest, and upstream `rpi-image-gen` cloud-init integration is still open. Imager 1.x
may display customization but applies the wrong mechanism to Trixie. WhereHouse now respects the OS
hostname if a supported provisioning method sets it, but the release must not claim customization
until the dedicated physical follow-up passes. Do not enable SSH with a universal credential.

## Data, external storage, and backup

The default data root is `/var/lib/wherehouse`. For an external data disk, mount its filesystem there
by UUID before starting WhereHouse; never use transient `/dev/sdX` names. Alternatively, keep live data
internal and configure a mounted backup disk through the existing provider-neutral CLI. Never place
live PostgreSQL data in Dropbox or another sync-provider directory.

Missing, unwritable, or critically full storage prevents startup or known-dangerous backup/update
work. WhereHouse never deletes inventory to reclaim space. Backup retention stays in the existing
backup service and restore uses the same `.whbackup` flow; there is no Pi-specific format.

## Application update

Place a verified release tar containing `wherehouse-api:<version>` and `wherehouse-web:<version>` at
`/var/lib/wherehouse/releases/<version>/wherehouse-runtime.tar`, then run:

```sh
sudo /opt/wherehouse/deploy/raspberry-pi/wherehouse-ops update <version>
```

This requires 1 GiB free, creates a backup with writes stopped, records current image IDs, loads the
release, migrates, waits for health, and records success. Failed health restores prior containers.
Migrations may be irreversible; if the prior application cannot use the schema, recreate cleanly and
restore the pre-upgrade backup. OS/image upgrades are separate. Secure release download/signing is not
implemented and remains a release blocker.

## Factory reset and recovery

There is no reset HTTP endpoint. Reset preserves OS network configuration and backups unless
`--delete-backups` is supplied:

```sh
sudo /opt/wherehouse/deploy/raspberry-pi/wherehouse-ops factory-reset \
  --confirm 'DELETE ALL WHEREHOUSE DATA'
```

This removes application identity, credentials, database, media, and configuration. Recovery notes:

- Inspect systemd, journal, and `docker compose ps` before restarting a failed app.
- Never delete/recreate PostgreSQL after migration failure; use the clean-restore path.
- Restore the expected UUID mount/permissions before restarting after storage failure.
- On full storage, remove only known expendable OS/release data or apply backup retention; never delete
  database/media directly.
- Corrupt backups are refused; use another verified artifact. Dropbox failure does not stop local use.

Normal shutdown gives containers/PostgreSQL 60 seconds. Abrupt power removal can corrupt filesystems
or data; a UPS and SSD are recommended. No unperformed crash-consistency claim is made.
