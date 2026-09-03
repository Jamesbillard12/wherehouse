#!/bin/sh
set -eu

RPI_IMAGE_GEN_VERSION=${RPI_IMAGE_GEN_VERSION:-v2.6.0}
RPI_IMAGE_GEN_COMMIT=${RPI_IMAGE_GEN_COMMIT:-3f2c916086ad70197945bfc50ef953c1f6035f10}
BUILDER_IMAGE=${WHEREHOUSE_PI_BUILDER_IMAGE:-wherehouse-pi-builder:${RPI_IMAGE_GEN_VERSION#v}}

usage() { echo "Usage: $0 <version> <pi4|pi5>" >&2; exit 2; }
[ "$#" -eq 2 ] || usage
version=$1
device=$2
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$script_dir/boards.sh"
config=$(board_config "$device") || {
  echo "Unsupported board '$device'; supported boards: $supported_boards" >&2
  exit 2
}

repository=$(git rev-parse --show-toplevel)
if [ "${WHEREHOUSE_ALLOW_DIRTY:-0}" != 1 ] && \
  { ! git -C "$repository" diff --quiet || ! git -C "$repository" diff --cached --quiet; }; then
  echo "Refusing to build a release image from an uncommitted worktree" >&2
  exit 1
fi

ssh_public_key_file=${WHEREHOUSE_SSH_PUBLIC_KEY_FILE:-}
if [ -n "$ssh_public_key_file" ]; then
  if [ ! -f "$ssh_public_key_file" ]; then
    echo "SSH public key file does not exist: $ssh_public_key_file" >&2
    exit 1
  fi
  ssh_public_key_file=$(CDPATH= cd -- "$(dirname -- "$ssh_public_key_file")" && pwd)/$(basename -- "$ssh_public_key_file")
  if [ "$(wc -l < "$ssh_public_key_file" | tr -d ' ')" -ne 1 ] || \
     ! grep -Eq '^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(256|384|521))[[:space:]]+[A-Za-z0-9+/=]+' "$ssh_public_key_file"; then
    echo "WHEREHOUSE_SSH_PUBLIC_KEY_FILE must contain exactly one OpenSSH public key" >&2
    exit 1
  fi
fi

docker_bin=${DOCKER_BIN:-docker}
if ! command -v "$docker_bin" >/dev/null 2>&1; then
  echo "Docker is required. On macOS, install and start Docker Desktop." >&2
  exit 1
fi
if ! "$docker_bin" info >/dev/null 2>&1; then
  echo "Docker is installed but its daemon is not running. Start Docker Desktop." >&2
  exit 1
fi

host_os=${WHEREHOUSE_TEST_HOST_OS:-$(uname -s)}
host_arch=${WHEREHOUSE_TEST_HOST_ARCH:-$(uname -m)}
case "$host_os/$host_arch" in
  Darwin/arm64|Linux/aarch64|Linux/arm64) ;;
  *) echo "Unsupported build host $host_os/$host_arch; use Apple Silicon macOS or Linux ARM64." >&2; exit 1 ;;
esac

for required in Dockerfile docker-entrypoint.sh boards.sh "config/$config" \
  layer/wherehouse-appliance.yaml bdebstrap/customize99-wherehouse; do
  if [ ! -f "$script_dir/$required" ]; then
    echo "Required image-builder file is missing: deploy/raspberry-pi/image/$required" >&2
    exit 1
  fi
done

echo "WhereHouse Raspberry Pi Image Builder"
echo "Version: $version"
echo "Board: $device ($(board_description "$device"))"
echo "Host: $host_os $host_arch"
echo "Builder platform: linux/arm64"
echo "rpi-image-gen: $RPI_IMAGE_GEN_VERSION ($RPI_IMAGE_GEN_COMMIT)"
if [ -n "$ssh_public_key_file" ]; then
  echo "SSH diagnostics: enabled for wherehouse user with explicitly supplied public key"
else
  echo "SSH diagnostics: no login account provisioned (set WHEREHOUSE_SSH_PUBLIC_KEY_FILE to enable)"
fi

output=${WHEREHOUSE_PI_OUTPUT_DIR:-$repository/dist/pi}
mkdir -p "$output"
rm -f \
  "$output/wherehouse-$device-$version.img.xz" \
  "$output/wherehouse-$device-$version.img.xz.sha256" \
  "$output/wherehouse-$device-$version.img.xz.json"
docker_endpoint=$("$docker_bin" context inspect --format '{{(index .Endpoints "docker").Host}}' 2>/dev/null || true)
case "$docker_endpoint" in
  unix://*) docker_socket=${docker_endpoint#unix://} ;;
  *) docker_socket=/var/run/docker.sock ;;
esac
"$docker_bin" build --platform linux/arm64 \
  --build-arg "RPI_IMAGE_GEN_VERSION=$RPI_IMAGE_GEN_VERSION" \
  --build-arg "RPI_IMAGE_GEN_COMMIT=$RPI_IMAGE_GEN_COMMIT" \
  -t "$BUILDER_IMAGE" \
  -f "$repository/deploy/raspberry-pi/image/Dockerfile" \
  "$repository/deploy/raspberry-pi/image"

set -- run --rm --privileged --platform linux/arm64 \
  -e "HOST_UID=$(id -u)" -e "HOST_GID=$(id -g)" \
  -e "RPI_IMAGE_GEN_VERSION=$RPI_IMAGE_GEN_VERSION" \
  -e "RPI_IMAGE_GEN_COMMIT=$RPI_IMAGE_GEN_COMMIT" \
  -v "$repository:/workspace" \
  -v "$output:/output" \
  -v "$docker_socket:/var/run/docker.sock" \
  -v wherehouse-pi-image-cache:/image-cache
if [ -n "$ssh_public_key_file" ]; then
  set -- "$@" -v "$ssh_public_key_file:/run/wherehouse-ssh-key.pub:ro"
fi
set -- "$@" "$BUILDER_IMAGE" "$version" "$device"
"$docker_bin" "$@"

artifact="$output/wherehouse-$device-$version.img.xz"
for expected in "$artifact" "$artifact.sha256" "$artifact.json"; do
  if [ ! -f "$expected" ]; then
    echo "Build completed without expected artifact: $expected" >&2
    exit 1
  fi
done
echo "Image complete: $artifact"
