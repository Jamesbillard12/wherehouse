# syntax=docker/dockerfile:1.7
FROM --platform=linux/arm64 debian:trixie-slim

ARG RPI_IMAGE_GEN_VERSION=v2.6.0

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update \
    && apt-get install --no-install-recommends -y ca-certificates curl docker.io git python3 xz-utils \
    && rm -f /var/cache/apt/archives/lock /var/lib/apt/lists/lock

RUN git clone --branch "$RPI_IMAGE_GEN_VERSION" --depth 1 \
      https://github.com/raspberrypi/rpi-image-gen.git /opt/rpi-image-gen \
    && cd /opt/rpi-image-gen \
    && ./install_deps.sh

COPY docker-entrypoint.sh /usr/local/bin/wherehouse-pi-build
RUN chmod 0755 /usr/local/bin/wherehouse-pi-build
WORKDIR /workspace
ENTRYPOINT ["/usr/local/bin/wherehouse-pi-build"]
