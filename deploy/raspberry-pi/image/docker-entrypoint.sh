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

# Do not add a broad Type=ether systemd-networkd rule here. rpi-image-gen's
# Raspberry Pi base already configures eth0 for DHCP. A Type=ether rule also
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
root_mount=$(mktemp -d)
cleanup_image_mounts() {
  umount "$root_mount" 2>/dev/null || true
  umount "$boot_mount" 2>/dev/null || true
  losetup -d "$root_loop" 2>/dev/null || true
  losetup -d "$boot_loop" 2>/dev/null || true
  rmdir "$root_mount" "$boot_mount" 2>/dev/null || true
}
trap 'cleanup_image_mounts; rm -rf "$stage"' EXIT INT TERM

boot_uuid=$(blkid -s UUID -o value "$boot_loop")
root_uuid=$(blkid -s UUID -o value "$root_loop")
test -n "$boot_uuid"
test -n "$root_uuid"

mount "$boot_loop" "$boot_mount"
mount "$root_loop" "$root_mount"
cmdline="$boot_mount/cmdline.txt"
fstab="$root_mount/etc/fstab"
test -f "$cmdline"
test -f "$fstab"
sed -i "s#root=/dev/disk/by-slot/system#root=UUID=$root_uuid#g" "$cmdline"
sed -i "s#/dev/disk/by-slot/system#UUID=$root_uuid#g" "$fstab"
sed -i "s#/dev/disk/by-slot/boot#UUID=$boot_uuid#g" "$fstab"
if grep -q '/dev/disk/by-slot/' "$cmdline" "$fstab"; then
  echo "Generated image still depends on /dev/disk/by-slot aliases" >&2
  exit 1
fi
if ! grep -q "root=UUID=$root_uuid" "$cmdline"; then
  echo "Generated kernel command line is missing root filesystem UUID" >&2
  exit 1
fi
if ! grep -q "UUID=$root_uuid[[:space:]]\+/[[:space:]]" "$fstab"; then
  echo "Generated fstab is missing root filesystem UUID" >&2
  exit 1
fi
if ! grep -q "UUID=$boot_uuid[[:space:]]\+/boot/firmware[[:space:]]" "$fstab"; then
  echo "Generated fstab is missing boot filesystem UUID" >&2
  exit 1
fi
sync
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
