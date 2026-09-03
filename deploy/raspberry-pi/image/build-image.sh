#!/bin/sh
set -eu

if [ "$#" -lt 2 ] || [ "$#" -gt 3 ]; then
  echo "Usage: $0 <version> <path-to-rpi-image-gen> [pi4|pi5]" >&2
  exit 2
fi

version=$1
generator=$(realpath "$2")
models=${3:-"pi4 pi5"}
repository=$(git rev-parse --show-toplevel)
if ! git -C "$repository" diff --quiet || ! git -C "$repository" diff --cached --quiet; then
  echo "Refusing to build a release image from an uncommitted worktree" >&2
  exit 1
fi
output="$repository/dist/pi"
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT INT TERM
mkdir -p "$stage/config" "$stage/layer" "$output"
cp -R "$repository/deploy/raspberry-pi/image/config/." "$stage/config/"
cp -R "$repository/deploy/raspberry-pi/image/layer/." "$stage/layer/"
build_date=$(date -u +%Y-%m-%dT%H:%M:%SZ)

docker build --platform linux/arm64 -t "wherehouse-api:$version" -t wherehouse-api:local "$repository/backend"
docker build --platform linux/arm64 -t "wherehouse-web:$version" -t wherehouse-web:local -f "$repository/deploy/docker/Dockerfile.web" "$repository"
docker pull --platform linux/arm64 postgres:17-alpine
mkdir -p "$stage/container-images"
docker save --output "$stage/container-images/wherehouse-runtime.tar" \
  "wherehouse-api:$version" wherehouse-api:local "wherehouse-web:$version" wherehouse-web:local postgres:17-alpine
cp "$stage/container-images/wherehouse-runtime.tar" "$output/wherehouse-runtime-$version.tar"
(cd "$output" && sha256sum "wherehouse-runtime-$version.tar") > \
  "$output/wherehouse-runtime-$version.tar.sha256"

for model in $models; do
  overlay="$stage/layer/wherehouse-appliance.rootfs-overlay"
  rm -rf "$overlay"
  mkdir -p "$overlay/opt/wherehouse" "$overlay/etc/systemd/system"
  git -C "$repository" archive --format=tar HEAD | tar -xf - -C "$overlay/opt/wherehouse"
  cp "$repository/deploy/raspberry-pi/systemd/"*.service "$overlay/etc/systemd/system/"
  mkdir -p "$overlay/opt/wherehouse/deploy/raspberry-pi/images"
  cp "$stage/container-images/wherehouse-runtime.tar" "$overlay/opt/wherehouse/deploy/raspberry-pi/images/"
  cat > "$overlay/etc/wherehouse-image" <<EOF
WHEREHOUSE_IMAGE_VERSION=$version
WHEREHOUSE_BUILD_DATE=$build_date
EOF
  "$generator/rpi-image-gen" build -S "$stage" -c "$stage/config/wherehouse-$model.yaml" -- \
    IGconf_artefact_version="$version"
  image=$(find "$generator/work" -type f -name "wherehouse-$model.img" -print | sort | tail -1)
  test -n "$image"
  artifact="$output/wherehouse-$model-$version.img.xz"
  xz -T0 -9 -c "$image" > "$artifact"
  (cd "$output" && sha256sum "$(basename "$artifact")") > "$artifact.sha256"
  cat > "$artifact.json" <<EOF
{"image_version":"$version","application_version":"$version","build_date":"$build_date","hardware":["Raspberry Pi ${model#pi}"],"architecture":"arm64","base":"Raspberry Pi OS Lite 64-bit (Trixie)"}
EOF
done
