# syntax=docker/dockerfile:1
FROM --platform=linux/arm64 debian:bookworm-slim

ARG RPI_IMAGE_GEN_VERSION=v2.6.0
ARG RPI_IMAGE_GEN_COMMIT=3f2c916086ad70197945bfc50ef953c1f6035f10

RUN apt-get update \
    && apt-get install --no-install-recommends -y \
      autoconf automake autopoint bash btrfs-progs build-essential ca-certificates coreutils \
      cryptsetup curl dbus-user-session dctrl-tools debian-archive-keyring docker.io dosfstools \
      dpkg-dev e2fsprogs fdisk flex gettext git grep libtool make mmdebstrap mount mtools pkgconf podman pv \
      python3 python3-debian python3-jsonschema python3-pip python3-yaml rsync uidmap util-linux \
      uuid-runtime xz-utils zip \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --branch "$RPI_IMAGE_GEN_VERSION" --depth 1 \
      https://github.com/raspberrypi/rpi-image-gen.git /opt/rpi-image-gen \
    && test "$(git -C /opt/rpi-image-gen rev-parse HEAD)" = "$RPI_IMAGE_GEN_COMMIT" \
    && /opt/rpi-image-gen/rpi-image-gen metadata --help >/dev/null

COPY docker-entrypoint.sh /usr/local/bin/wherehouse-pi-build
RUN chmod 0755 /usr/local/bin/wherehouse-pi-build
WORKDIR /workspace
ENTRYPOINT ["/usr/local/bin/wherehouse-pi-build"]
