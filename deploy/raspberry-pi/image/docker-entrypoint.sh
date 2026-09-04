#!/bin/sh
set -eu

repository=/workspace
generator=/opt/rpi-image-gen
version=${1:?version is required}
device=${2:?device is required}
. "$repository/deploy/raspberry-pi/image/boards.sh"
config=$(board_config "$device") || { echo "Unsupported board: $device" >&2; exit 2; }
output=${WHEREHOUSE_PI_OUTPUT_DIR:-/output}
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT INT TERM
mkdir -p "$stage/config" "$stage/layer" "$stage/bdebstrap" "$stage/container-images" "$output"
cp -R "$repository/deploy/raspberry-pi/image/config/." "$stage/config/"
cp -R "$repository/deploy/raspberry-pi/image/layer/." "$stage/layer/"
cp -R "$repository/deploy/raspberry-pi/image/bdebstrap/." "$stage/bdebstrap/"
build_date=$(date -u +%Y-%m-%dT%H:%M:%SZ)

git config --global --add safe.directory "$repository"
docker build --platform linux/arm64 -t "wherehouse-api:$version" -t wherehouse-api:local "$repository/backend"
docker build --platform linux/arm64 -t "wherehouse-web:$version" -t wherehouse-web:local \
  -f "$repository/deploy/docker/Dockerfile.web" "$repository"
docker pull --platform linux/arm64 postgres:17-bookworm
docker save --output "$stage/container-images/wherehouse-runtime.tar" \
  "wherehouse-api:$version" wherehouse-api:local \
  "wherehouse-web:$version" wherehouse-web:local postgres:17-bookworm

overlay="$stage/layer/wherehouse-appliance.rootfs-overlay"
mkdir -p "$overlay/opt/wherehouse" "$overlay/etc/systemd/system"
git -C "$repository" archive --format=tar HEAD | tar -xf - -C "$overlay/opt/wherehouse"
rm -rf "$overlay/opt/wherehouse/deploy/raspberry-pi/image"
cp "$repository/deploy/raspberry-pi/systemd/"*.service "$overlay/etc/systemd/system/"
if [ -f /run/wherehouse-update-key.pem ]; then
  install -m 0644 /run/wherehouse-update-key.pem \
    "$overlay/opt/wherehouse/deploy/raspberry-pi/update-public-key.pem"
fi

# Do not add a broad Ethernet-type systemd-networkd rule here. rpi-image-gen's
# Raspberry Pi base already configures eth0 for DHCP. Such a rule also
# matches Docker veth interfaces and causes networkd to interfere with Docker's
# bridge endpoints, breaking container-to-container networking.

# Optional developer/admin SSH access. The public key is only staged when the
# host explicitly mounted /run/wherehouse-ssh-key.pub. The customize hook
# consumes it, creates the account, and removes the staging copy from /etc.
if [ -f /run/wherehouse-ssh-key.pub ]; then
  mkdir -p "$overlay/etc/wherehouse-build"
  install -m 0644 /run/wherehouse-ssh-key.pub "$overlay/etc/wherehouse-build/ssh-authorized-key"
fi

mkdir -p "$overlay/opt/wherehouse/deploy/raspberry-pi/images"
cp "$stage/container-images/wherehouse-runtime.tar" "$overlay/opt/wherehouse/deploy/raspberry-pi/images/"
cat > "$overlay/etc/wherehouse-image" <<EOF
WHEREHOUSE_IMAGE_VERSION=$version
WHEREHOUSE_BUILD_DATE=$build_date
WHEREHOUSE_UPDATE_MANIFEST_URL=${WHEREHOUSE_UPDATE_MANIFEST_URL:-}
EOF

mkdir -p "$generator/work"
if [ -d /image-cache/cache ]; then
  mkdir -p "$generator/work/cache"
  cp -a /image-cache/cache/. "$generator/work/cache/"
fi
(
  cd "$generator"
  ./rpi-image-gen build -S "$stage" -c "$stage/config/$config" -- \
    IGconf_artefact_version="$version"
)
rm -rf /image-cache/cache
mkdir -p /image-cache/cache
if [ -d "$generator/work/cache" ]; then cp -a "$generator/work/cache/." /image-cache/cache/; fi

image=$(find "$generator/work" -type f -name "wherehouse-$device.img" -print | sort | tail -1)
test -n "$image"

# Validate the generated root filesystem directly before packaging. This keeps
# structural appliance validation independent of the host kernel's ability to
# mount the final ext4 filesystem. Pi 5 images use 16 KiB ext4 blocks, while
# GitHub-hosted ARM64 runners currently expose a kernel limited to 4 KiB blocks.
generated_rootfs=$(find "$generator/work" -type d -path '*/filesystem' -print | sort | tail -1)
test -n "$generated_rootfs"
expected_ssh_key=
if [ "${WHEREHOUSE_SSH_MODE:-disabled}" = key ]; then
  expected_ssh_key=/run/wherehouse-ssh-key.pub
fi
"$repository/deploy/raspberry-pi/image/validate-rootfs.sh" \
  "$generated_rootfs" "$version" "${WHEREHOUSE_SSH_MODE:-disabled}" \
  "$expected_ssh_key" \
  "${WHEREHOUSE_UPDATE_MODE:-disabled}"

partition_geometry() {
  python3 - "$image" "$1" <<'PY'
import json
import subprocess
import sys

image = sys.argv[1]
number = int(sys.argv[2])
data = json.loads(subprocess.check_output(["sfdisk", "--json", image], text=True))
table = data["partitiontable"]
partitions = table["partitions"]
if number < 1 or number > len(partitions):
    raise SystemExit(f"partition {number} is missing from {image}")
partition = partitions[number - 1]
sector_size = int(table.get("sectorsize", 512))
print(partition["start"], partition["size"], sector_size)
PY
}

set -- $(partition_geometry 1)
boot_start=$1
boot_size=$2
boot_sector_size=$3
set -- $(partition_geometry 2)
root_start=$1
root_size=$2
root_sector_size=$3

boot_loop=$(losetup --find --show \
  --offset $((boot_start * boot_sector_size)) \
  --sizelimit $((boot_size * boot_sector_size)) \
  "$image")
root_loop=$(losetup --find --show \
  --offset $((root_start * root_sector_size)) \
  --sizelimit $((root_size * root_sector_size)) \
  "$image")
boot_mount=$(mktemp -d)
cleanup_image_mounts() {
  umount "$boot_mount" 2>/dev/null || true
  losetup -d "$root_loop" 2>/dev/null || true
  losetup -d "$boot_loop" 2>/dev/null || true
  rmdir "$boot_mount" 2>/dev/null || true
}
trap 'cleanup_image_mounts; rm -rf "$stage"' EXIT INT TERM

boot_uuid=$(blkid -s UUID -o value "$boot_loop")
root_uuid=$(blkid -s UUID -o value "$root_loop")
test -n "$boot_uuid"
test -n "$root_uuid"

# The boot partition is FAT and can be mounted on all supported build hosts.
mount "$boot_loop" "$boot_mount"
cmdline="$boot_mount/cmdline.txt"
test -f "$cmdline"
sed -i "s#root=/dev/disk/by-slot/system#root=UUID=$root_uuid#g" "$cmdline"
if grep -q '/dev/disk/by-slot/' "$cmdline"; then
  echo "Generated kernel command line still depends on /dev/disk/by-slot aliases" >&2
  exit 1
fi
if ! grep -q "root=UUID=$root_uuid" "$cmdline"; then
  echo "Generated kernel command line is missing root filesystem UUID" >&2
  exit 1
fi
sync
umount "$boot_mount"

# Read and update /etc/fstab with e2fsprogs instead of mounting the root
# filesystem. debugfs reads ext4 directly and therefore works with the Pi 5's
# 16 KiB block size even when the host kernel cannot mount that filesystem.
fstab_tmp=$(mktemp)
patched_fstab=$(mktemp)
debugfs -R "dump -p /etc/fstab $fstab_tmp" "$root_loop" >/dev/null 2>&1
test -s "$fstab_tmp"
sed \
  -e "s#/dev/disk/by-slot/system#UUID=$root_uuid#g" \
  -e "s#/dev/disk/by-slot/boot#UUID=$boot_uuid#g" \
  "$fstab_tmp" > "$patched_fstab"
if grep -q '/dev/disk/by-slot/' "$patched_fstab"; then
  echo "Generated fstab still depends on /dev/disk/by-slot aliases" >&2
  exit 1
fi
if ! grep -q "UUID=$root_uuid[[:space:]]\+/[[:space:]]" "$patched_fstab"; then
  echo "Generated fstab is missing root filesystem UUID" >&2
  exit 1
fi
if ! grep -q "UUID=$boot_uuid[[:space:]]\+/boot/firmware[[:space:]]" "$patched_fstab"; then
  echo "Generated fstab is missing boot filesystem UUID" >&2
  exit 1
fi

debugfs -w -R "rm /etc/fstab" "$root_loop" >/dev/null 2>&1
debugfs -w -R "write $patched_fstab /etc/fstab" "$root_loop" >/dev/null 2>&1
debugfs -w -R "set_inode_field /etc/fstab mode 0100644" "$root_loop" >/dev/null 2>&1
verified_fstab=$(mktemp)
debugfs -R "dump -p /etc/fstab $verified_fstab" "$root_loop" >/dev/null 2>&1
cmp -s "$patched_fstab" "$verified_fstab" || {
  echo "Generated fstab verification failed after writing filesystem UUIDs" >&2
  exit 1
}
rm -f "$fstab_tmp" "$patched_fstab" "$verified_fstab"

cleanup_image_mounts
trap 'rm -rf "$stage"' EXIT INT TERM

artifact="$output/wherehouse-$device-$version.img.xz"
xz -T0 -9 -c "$image" > "$artifact"
python3 "$repository/deploy/raspberry-pi/image/release_metadata.py" \
  "$artifact" "$version" "$device" "$RPI_IMAGE_GEN_VERSION" "$build_date"
cp "$stage/container-images/wherehouse-runtime.tar" "$output/wherehouse-runtime-$version.tar"
python3 "$repository/deploy/raspberry-pi/image/release_metadata.py" \
  "$output/wherehouse-runtime-$version.tar" "$version" runtime "$RPI_IMAGE_GEN_VERSION" "$build_date" --checksum-only
chown -R "${HOST_UID:-0}:${HOST_GID:-0}" "$output" || \
  echo "Warning: Docker Desktop retained ownership mapping for dist/pi; artifacts are complete." >&2
