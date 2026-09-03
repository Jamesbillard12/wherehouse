#!/bin/sh
set -eu

RPI_IMAGE_GEN_VERSION=${RPI_IMAGE_GEN_VERSION:-v2.6.0}
BUILDER_IMAGE=${WHEREHOUSE_PI_BUILDER_IMAGE:-wherehouse-pi-builder:${RPI_IMAGE_GEN_VERSION#v}}

usage() { echo "Usage: $0 <version> <pi4|pi5>" >&2; exit 2; }
[ "$#" -eq 2 ] || usage
version=$1
device=$2
case "$device" in
  pi4|pi5) ;;
  *) echo "Unsupported device '$device'; expected pi4 or pi5" >&2; exit 2 ;;
esac

repository=$(git rev-parse --show-toplevel)
if [ "${WHEREHOUSE_ALLOW_DIRTY:-0}" != 1 ] && \
  { ! git -C "$repository" diff --quiet || ! git -C "$repository" diff --cached --quiet; }; then
  echo "Refusing to build a release image from an uncommitted worktree" >&2
  exit 1
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

mkdir -p "$repository/dist/pi"
docker_endpoint=$("$docker_bin" context inspect --format '{{(index .Endpoints "docker").Host}}' 2>/dev/null || true)
case "$docker_endpoint" in
  unix://*) docker_socket=${docker_endpoint#unix://} ;;
  *) docker_socket=/var/run/docker.sock ;;
esac
"$docker_bin" build --platform linux/arm64 \
  --build-arg "RPI_IMAGE_GEN_VERSION=$RPI_IMAGE_GEN_VERSION" \
  -t "$BUILDER_IMAGE" \
  -f "$repository/deploy/raspberry-pi/image/Dockerfile" \
  "$repository/deploy/raspberry-pi/image"

"$docker_bin" run --rm --privileged --platform linux/arm64 \
  -e "HOST_UID=$(id -u)" -e "HOST_GID=$(id -g)" \
  -e "RPI_IMAGE_GEN_VERSION=$RPI_IMAGE_GEN_VERSION" \
  -v "$repository:/workspace" \
  -v "$docker_socket:/var/run/docker.sock" \
  -v wherehouse-pi-image-cache:/image-cache \
  "$BUILDER_IMAGE" "$version" "$device"
