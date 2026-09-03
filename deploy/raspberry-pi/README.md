# Raspberry Pi appliance implementation

This directory packages the canonical Docker Compose deployment into model-specific Raspberry Pi OS
Lite 64-bit images for Pi 4 and Pi 5. Separate images follow `rpi-image-gen`'s hardware device layers;
both support SD and USB boot media supported by the selected Pi firmware. Pi 4 NVMe is not claimed by
the upstream `rpi4` image layer.

## Build a release image

Use an ARM64 Raspberry Pi OS Bookworm/Trixie builder with Docker and pinned `rpi-image-gen`:

```sh
git clone --branch v2.6.0 https://github.com/raspberrypi/rpi-image-gen.git ../rpi-image-gen
sudo ../rpi-image-gen/install_deps.sh
./deploy/raspberry-pi/image/build-image.sh 0.1.0 ../rpi-image-gen
```

The build refuses a dirty tree, embeds the committed snapshot, prebuilds ARM64 containers, and emits
`wherehouse-pi<model>-<version>.img.xz`, `.sha256`, and `.json` metadata in `dist/pi/`. No finished
image is manually edited. CI runs the same command. Image generation and physical boot remain not run.

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

Avahi publishes `wherehouse.local`. When `.local` is unavailable on a VLAN or unsupported client, use
the Pi's DHCP address. SSH is disabled. Provision network credentials per installation with Raspberry
Pi Imager; no release image contains credentials.

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
