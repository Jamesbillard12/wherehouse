# Raspberry Pi appliance implementation

This directory packages the canonical Docker Compose deployment into model-specific Raspberry Pi OS
Lite 64-bit images for Pi 4 and Pi 5. Separate images follow `rpi-image-gen`'s hardware device layers;
both support SD and USB boot media supported by the selected Pi firmware. Pi 4 NVMe is not claimed by
the upstream `rpi4` image layer.

## Build a release image

Apple Silicon macOS with Docker Desktop installed and running is a supported image build host. The
script starts a privileged `linux/arm64` Debian Bookworm container, fetches pinned `rpi-image-gen`
v2.6.0 at commit `3f2c916086ad70197945bfc50ef953c1f6035f10` in
the builder image, and keeps Linux-only dependencies off macOS. No Raspberry Pi or manual
`rpi-image-gen` clone is required.

```sh
./deploy/raspberry-pi/image/build-image.sh 0.1.0 pi5
# or
./deploy/raspberry-pi/image/build-image.sh 0.1.0 pi4
```

For physical validation or an explicitly administered appliance, a build can provision a dedicated
key-only `wherehouse` SSH administrator. The key must be supplied explicitly; normal builds do not
embed a maintainer key or shared password:

```sh
WHEREHOUSE_SSH_PUBLIC_KEY_FILE="$HOME/.ssh/id_ed25519.pub" \
  ./deploy/raspberry-pi/image/build-image.sh 0.1.4 pi4
```

The public key may also be passed directly. This complete macOS example enables signed OTA too:

```sh
WHEREHOUSE_SSH_MODE=key \
WHEREHOUSE_SSH_PUBLIC_KEY="$(cat "$HOME/.ssh/id_ed25519.pub")" \
WHEREHOUSE_UPDATE_MODE=enabled \
WHEREHOUSE_UPDATE_MANIFEST_URL=https://github.com/Jamesbillard12/wherehouse/releases/latest/download/release.json \
WHEREHOUSE_UPDATE_PUBLIC_KEY_FILE=/secure/wherehouse-release-public.pem \
  ./deploy/raspberry-pi/image/build-image.sh 0.1.2 pi5
```

Use `WHEREHOUSE_SSH_MODE=disabled` or `WHEREHOUSE_UPDATE_MODE=disabled` only for an intentionally
unmanaged/offline image. Key mode fails without one valid public key. Enabled OTA mode fails unless
both trust inputs are supplied. Never pass an SSH private key or release-signing private key.

When this option is used the image creates `wherehouse`, installs only the supplied public key in
`authorized_keys`, disables password and keyboard-interactive authentication for that account, and
grants passwordless `sudo` for appliance diagnostics. The private key never enters the build. Do not
use a personal maintainer key in a public release image.

The build verifies Docker/host architecture and required configuration, refuses unsupported boards
and dirty trees, embeds the committed snapshot, and builds every application dependency inside Linux
ARM64. A named `rpi-image-gen` package cache speeds later builds without caching final images.
Set `RPI_IMAGE_GEN_VERSION` only when deliberately testing another pinned release; the supported
default and expected commit are declared in `build-image.sh` and passed into the Docker build.

The builder uses stable Debian Bookworm rather than Trixie because both are supported build hosts by
upstream, while Bookworm is the stable base and the target OS may still be Trixie. The complete
v2.6.0 `depends` manifest is installed explicitly in the same Docker layer as `apt-get update`.
`install_deps.sh` is deliberately not run: Docker APT list cleanup between layers caused the previous
“package cannot be found” failure. Package lists are removed only after installation succeeds.

Outputs are `dist/pi/wherehouse-pi5-0.1.0.img.xz` (or Pi 4), its `.sha256`, and `.json`, plus the
separately checksummed application-update runtime tar. The JSON records product/app/build/generator,
device, architecture, base OS, and hardware metadata. After `rpi-image-gen` creates the disk image, the
builder resolves the actual boot and root filesystem UUIDs and rewrites the generated kernel command
line and `/etc/fstab` to use those stable identifiers. Release images therefore do not depend on
`/dev/disk/by-slot/*` udev aliases being present in initramfs.

Verify the compressed artifact on macOS, then choose it in Raspberry Pi Imager through
**Choose OS → Use custom**:

```sh
cd dist/pi
shasum -a 256 -c wherehouse-pi5-0.1.0.img.xz.sha256
```

The Docker container requires `--privileged` because `rpi-image-gen` builds filesystems using mount
namespaces and the final boot-identifier verification attaches the generated disk image through loop
devices at the partition offsets. It mounts the Docker Desktop socket so backend/web/PostgreSQL images
are built/saved as Linux ARM64 rather than copying macOS binaries. The generated `.img.xz` remains a
normal `image-rpios` disk image accepted by Raspberry Pi Imager.

During a normal run the wrapper prints version, board, detected host, `linux/arm64`, the pinned
generator revision, and whether explicit SSH diagnostics were provisioned. Failures propagate without
creating a success message. The builder refuses to release an image if the kernel command line or
fstab still contains `/dev/disk/by-slot/`, or mounted-rootfs validation finds a missing user, key,
permission, service, updater input, version marker, Compose file, or runtime payload. The final line
names the verified host artifact.

### Build troubleshooting

- `Docker is required`: install Docker Desktop for Apple Silicon.
- `daemon is not running`: start Docker Desktop and wait for `docker info` to succeed.
- `unsupported build host`: confirm the Mac is Apple Silicon (`uname -m` prints `arm64`).
- invalid `WHEREHOUSE_SSH_PUBLIC_KEY_FILE`: supply a file containing exactly one OpenSSH public key.
- builder dependency failure: rebuild without Docker cache and retain the failing package name:
  `docker builder prune` is not required and should not be the first response.
- mount/namespace/loop failure: confirm Docker Desktop permits privileged containers. The image build
  intentionally runs under `docker run --privileged`, and final filesystem UUID verification also
  needs loop devices and temporary filesystem mounts.
- `Generated image still depends on /dev/disk/by-slot aliases`: do not flash the image. Inspect the
  upstream image layout or post-build rewrite before releasing it.
- missing expected artifact: inspect the preceding `rpi-image-gen` failure; the wrapper refuses to
  report success unless the image, checksum, and metadata all exist.

Pi 5 is the initial required build target. Pi 4 has an isolated configuration and is under physical
validation. A future Pi Zero 2 W can be added in `boards.sh` plus one config file without changing
generic builder orchestration. Original ARMv6 Pi Zero W support is out of scope.

## First boot and lifecycle

`wherehouse.service` creates `/var/lib/wherehouse`, generates a UUID, database password, and app
secret with OS entropy, persists them mode `0600`, loads embedded containers once, validates storage,
and starts the canonical Compose dependency chain. It never creates an application user or workspace.
A Linux `wherehouse` administrator account is created only when an SSH public key was explicitly
supplied at image build time. Reboots validate and reuse the same application state.

The appliance explicitly configures wired Ethernet links for DHCP with `systemd-networkd`. Matching
by Ethernet link type avoids depending on whether a Raspberry Pi exposes the interface as `eth0`,
`end0`, or another predictable name. Ethernet is therefore the supported zero-configuration first-boot
path. Avahi publishes `<hostname>.local`, which defaults to `wherehouse.local`. If `.local` is
unavailable on a VLAN or unsupported client, use the DHCP address assigned by the router.

```sh
sudo systemctl status systemd-networkd
networkctl status
ip -4 addr
sudo systemctl status wherehouse
sudo journalctl -u wherehouse -b
sudo wherehouse-ops status
curl http://localhost/api/v1/system/status
sudo systemctl restart wherehouse
sudo /opt/wherehouse/deploy/raspberry-pi/wherehouse-backup create local
```

When a key-enabled diagnostic image is flashed, connect with:

```sh
ssh wherehouse@wherehouse.local
```

`openssh-server` is installed and the SSH service is enabled, but normal builds do not create a
universal login username/password. Never ship shared credentials or an unintended maintainer key in a
release image.

### Raspberry Pi Imager customization limitation

Use Ethernet for initial physical validation. Standard Wi-Fi/hostname/user/SSH credential/locale/timezone
customization is **not currently supported or validated** when this Trixie `.img.xz` is selected with
**Use custom**. Raspberry Pi Imager 2.x treats a standalone local image as `init_format: none` unless
it is supplied through an OS manifest, and upstream `rpi-image-gen` cloud-init integration is still
open. Imager 1.x may display customization but applies the wrong mechanism to Trixie. WhereHouse
respects the OS hostname if a supported provisioning method sets it, but the release must not claim
Imager customization until the dedicated physical follow-up passes.

SSH being enabled at the service level does not make unsupported Raspberry Pi Imager user/password
customization reliable. Use the explicit public-key build option for diagnostic SSH access until a
first-boot provisioning mechanism is implemented.

## Data, external storage, and backup

The default data root is `/var/lib/wherehouse`. Settings → Storage can prepare a USB HDD/SSD as ext4
and migrate the complete private data root without SSH. The disk mounts by filesystem UUID at
`/mnt/wherehouse-storage`; `application/` is bind-mounted at `/var/lib/wherehouse`. The guided flow
derives and protects the active root/boot backing disk and never relies on transient `/dev/sdX` names.

If the configured disk is absent or has the wrong UUID, startup fails closed with “Primary storage
unavailable”; PostgreSQL is not initialized on the SD card. Power down, reconnect the correct disk,
and boot again. Never remove primary storage while the appliance is running.

After external primary storage is healthy, first-run setup or Settings → Network Storage can enable
the authenticated `Shared` SMB share. On macOS use Finder → Go → Connect to Server and
`smb://wherehouse.local/Shared`; on Windows use `\\wherehouse.local\Shared`. The credential is separate
from the WhereHouse account. NAS is opt-in and exposes only `shares/Shared`; application data and
backups remain private. Internal-SD NAS is unsupported for MVP so shared files cannot silently fill
the boot disk.

Alternatively, keep live data internal and configure a mounted backup disk through the existing
provider-neutral CLI. Primary storage is not a backup; a same-disk backup cannot protect against disk
failure. Never place live PostgreSQL data in Dropbox or another sync-provider directory.

Missing, unwritable, or critically full storage prevents startup or known-dangerous backup/update
work. WhereHouse never deletes inventory to reclaim space. Backup retention stays in the existing
backup service and restore uses the same `.whbackup` flow; there is no Pi-specific format.

## Application update

Normal updates are discovered and installed from Settings → System using a signed immutable GitHub
Release; no reflash, SSH, SCP, or manual Docker command is required. For console diagnostics or an
emergency retry, use the same host updater:

```sh
sudo /opt/wherehouse/deploy/raspberry-pi/wherehouse-ops update-status
sudo /opt/wherehouse/deploy/raspberry-pi/wherehouse-ops update-check
sudo /opt/wherehouse/deploy/raspberry-pi/wherehouse-ops update
sudo systemctl status wherehouse-update.service
sudo journalctl -u wherehouse-update.service -b --no-pager
```

The updater starts before the application and preserves `/run/wherehouse` across service restarts so
the API container retains the live host socket. `config/appliance.env` plus `releases/current` after
OTA is the authoritative installed-version source. Settings can therefore show the installed version
while separately reporting an updater-service failure.

This requires 1 GiB free, creates a backup with writes stopped, records current image IDs, loads the
release, migrates, waits for health, and records success. Failed health restores prior containers.
Migrations may be irreversible; OTA releases therefore require expand-contract migrations. If the
prior application cannot use the schema, recreate cleanly and
restore the pre-upgrade backup. OS/image upgrades are separate.

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
