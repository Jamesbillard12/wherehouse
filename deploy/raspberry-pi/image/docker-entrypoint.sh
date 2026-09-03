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
docker pull --platform linux/arm64 postgres:17-alpine
docker save --output "$stage/container-images/wherehouse-runtime.tar" \
  "wherehouse-api:$version" wherehouse-api:local \
  "wherehouse-web:$version" wherehouse-web:local postgres:17-alpine

overlay="$stage/layer/wherehouse-appliance.rootfs-overlay"
mkdir -p "$overlay/opt/wherehouse" "$overlay/etc/systemd/system" "$overlay/etc/systemd/network"
git -C "$repository" archive --format=tar HEAD | tar -xf - -C "$overlay/opt/wherehouse"
# Image construction tooling is host-only. Keeping its layer YAML in the target
# overlay makes rpi-image-gen recursively discover a duplicate layer.
rm -rf "$overlay/opt/wherehouse/deploy/raspberry-pi/image"
cp "$repository/deploy/raspberry-pi/systemd/"*.service "$overlay/etc/systemd/system/"
cat > "$overlay/etc/systemd/network/20-wired.network" <<'EOF'
[Match]
Name=eth*

[Network]
DHCP=yes
MulticastDNS=yes
EOF
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
artifact="$output/wherehouse-$device-$version.img.xz"
xz -T0 -9 -c "$image" > "$artifact"
python3 "$repository/deploy/raspberry-pi/image/release_metadata.py" \
  "$artifact" "$version" "$device" "$RPI_IMAGE_GEN_VERSION" "$build_date"
cp "$stage/container-images/wherehouse-runtime.tar" "$output/wherehouse-runtime-$version.tar"
python3 "$repository/deploy/raspberry-pi/image/release_metadata.py" \
  "$output/wherehouse-runtime-$version.tar" "$version" runtime "$RPI_IMAGE_GEN_VERSION" "$build_date" --checksum-only
chown -R "${HOST_UID:-0}:${HOST_GID:-0}" "$output" || \
  echo "Warning: Docker Desktop retained ownership mapping for dist/pi; artifacts are complete." >&2
