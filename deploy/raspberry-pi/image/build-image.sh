#!/bin/sh
set -eu

RPI_IMAGE_GEN_VERSION=${RPI_IMAGE_GEN_VERSION:-v2.6.0}
RPI_IMAGE_GEN_COMMIT=${RPI_IMAGE_GEN_COMMIT:-3f2c916086ad70197945bfc50ef953c1f6035f10}
BUILDER_IMAGE=${WHEREHOUSE_PI_BUILDER_IMAGE:-wherehouse-pi-builder:${RPI_IMAGE_GEN_VERSION#v}}

usage() { echo "Usage: $0 <version|next> <pi4|pi5>" >&2; exit 2; }
[ "$#" -eq 2 ] || usage
requested_version=$1
device=$2
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$script_dir/boards.sh"
config=$(board_config "$device") || {
  echo "Unsupported board '$device'; supported boards: $supported_boards" >&2
  exit 2
}

repository=$(git rev-parse --show-toplevel)
output=${WHEREHOUSE_PI_OUTPUT_DIR:-$repository/dist/pi}
mkdir -p "$output"

next_patch_version() {
  find "$output" -maxdepth 1 -type f -name 'wherehouse-pi[45]-*.img.xz' -print 2>/dev/null | \
    awk '
      BEGIN { found = 0; major = 0; minor = 1; patch = -1 }
      {
        name = $0
        sub(/^.*\/wherehouse-pi[45]-/, "", name)
        sub(/\.img\.xz$/, "", name)
        count = split(name, parts, ".")
        if (count != 3 || parts[1] !~ /^[0-9]+$/ || parts[2] !~ /^[0-9]+$/ || parts[3] !~ /^[0-9]+$/) next
        candidate_major = parts[1] + 0
        candidate_minor = parts[2] + 0
        candidate_patch = parts[3] + 0
        if (!found || candidate_major > major || \
            (candidate_major == major && candidate_minor > minor) || \
            (candidate_major == major && candidate_minor == minor && candidate_patch > patch)) {
          found = 1
          major = candidate_major
          minor = candidate_minor
          patch = candidate_patch
        }
      }
      END {
        if (found) printf "%d.%d.%d\n", major, minor, patch + 1
        else print "0.1.0"
      }
    '
}

if [ "$requested_version" = next ]; then
  version=$(next_patch_version)
  echo "Auto-selected next version: $version"
else
  version=$requested_version
  if ! printf '%s\n' "$version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'; then
    echo "Invalid version '$version'; use semantic version X.Y.Z or 'next'" >&2
    exit 2
  fi
fi

if [ "${WHEREHOUSE_ALLOW_DIRTY:-0}" != 1 ] && \
  { ! git -C "$repository" diff --quiet || ! git -C "$repository" diff --cached --quiet; }; then
  echo "Refusing to build a release image from an uncommitted worktree" >&2
  exit 1
fi

ssh_public_key_file=${WHEREHOUSE_SSH_PUBLIC_KEY_FILE:-}
ssh_public_key=${WHEREHOUSE_SSH_PUBLIC_KEY:-}
ssh_mode=${WHEREHOUSE_SSH_MODE:-}
if [ -n "$ssh_public_key_file" ] && [ -n "$ssh_public_key" ]; then
  echo "Set only one of WHEREHOUSE_SSH_PUBLIC_KEY or WHEREHOUSE_SSH_PUBLIC_KEY_FILE" >&2
  exit 1
fi
if [ -n "$ssh_public_key" ]; then
  ssh_public_key_file=$(mktemp "${TMPDIR:-/tmp}/wherehouse-ssh-key.XXXXXX")
  trap 'rm -f "$ssh_public_key_file"' EXIT INT TERM
  printf '%s\n' "$ssh_public_key" > "$ssh_public_key_file"
fi
if [ -z "$ssh_mode" ]; then
  if [ -n "$ssh_public_key_file" ]; then ssh_mode=key; else ssh_mode=disabled; fi
fi
case "$ssh_mode" in
  key)
    if [ -z "$ssh_public_key_file" ]; then
      echo "WHEREHOUSE_SSH_MODE=key requires WHEREHOUSE_SSH_PUBLIC_KEY or WHEREHOUSE_SSH_PUBLIC_KEY_FILE" >&2
      exit 1
    fi
    ;;
  disabled)
    if [ -n "$ssh_public_key_file" ]; then
      echo "WHEREHOUSE_SSH_MODE=disabled cannot be combined with an SSH public key" >&2
      exit 1
    fi
    ;;
  *) echo "WHEREHOUSE_SSH_MODE must be 'key' or 'disabled'" >&2; exit 1 ;;
esac
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
update_public_key_file=${WHEREHOUSE_UPDATE_PUBLIC_KEY_FILE:-}
update_manifest_url=${WHEREHOUSE_UPDATE_MANIFEST_URL:-}
update_mode=${WHEREHOUSE_UPDATE_MODE:-}
if [ -z "$update_mode" ]; then
  if [ -n "$update_public_key_file" ] || [ -n "$update_manifest_url" ]; then update_mode=enabled; else update_mode=disabled; fi
fi
case "$update_mode" in
  enabled)
    if [ -z "$update_public_key_file" ] || [ -z "$update_manifest_url" ]; then
      echo "WHEREHOUSE_UPDATE_MODE=enabled requires WHEREHOUSE_UPDATE_PUBLIC_KEY_FILE and WHEREHOUSE_UPDATE_MANIFEST_URL" >&2
      exit 1
    fi
    ;;
  disabled)
    if [ -n "$update_public_key_file" ] || [ -n "$update_manifest_url" ]; then
      echo "WHEREHOUSE_UPDATE_MODE=disabled cannot include updater configuration" >&2
      exit 1
    fi
    ;;
  *) echo "WHEREHOUSE_UPDATE_MODE must be 'enabled' or 'disabled'" >&2; exit 1 ;;
esac
case "$update_manifest_url" in
  ""|https://*) ;;
  *) echo "WHEREHOUSE_UPDATE_MANIFEST_URL must use HTTPS" >&2; exit 1 ;;
esac
if [ "$update_mode" = enabled ]; then
  [ -f "$update_public_key_file" ] || { echo "Update public key does not exist: $update_public_key_file" >&2; exit 1; }
  update_public_key_file=$(CDPATH= cd -- "$(dirname -- "$update_public_key_file")" && pwd)/$(basename -- "$update_public_key_file")
  openssl pkey -pubin -in "$update_public_key_file" -noout >/dev/null 2>&1 || {
    echo "WHEREHOUSE_UPDATE_PUBLIC_KEY_FILE must contain a valid public key" >&2; exit 1;
  }
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
  layer/wherehouse-appliance.yaml bdebstrap/customize99-wherehouse validate-rootfs.sh; do
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
if [ "$update_mode" = enabled ]; then
  echo "Application OTA: signed releases enabled"
else
  echo "Application OTA: disabled (set WHEREHOUSE_UPDATE_PUBLIC_KEY_FILE to enable)"
fi

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
  -e "WHEREHOUSE_UPDATE_MANIFEST_URL=$update_manifest_url" \
  -e "WHEREHOUSE_SSH_MODE=$ssh_mode" \
  -e "WHEREHOUSE_UPDATE_MODE=$update_mode" \
  -v "$repository:/workspace" \
  -v "$output:/output" \
  -v "$docker_socket:/var/run/docker.sock" \
  -v wherehouse-pi-image-cache:/image-cache
if [ -n "$ssh_public_key_file" ]; then
  set -- "$@" -v "$ssh_public_key_file:/run/wherehouse-ssh-key.pub:ro"
fi
if [ -n "$update_public_key_file" ]; then
  set -- "$@" -v "$update_public_key_file:/run/wherehouse-update-key.pem:ro"
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
