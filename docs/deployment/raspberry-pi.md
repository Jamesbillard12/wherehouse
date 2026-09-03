# Raspberry Pi deployment

The appliance build, first-boot, lifecycle, update, reset, storage, and recovery details live in
[`deploy/raspberry-pi/README.md`](../../deploy/raspberry-pi/README.md). They are an implementation
guide, not evidence of a physically validated appliance release.

The implementation uses model-specific Raspberry Pi OS Lite 64-bit images for Pi 4 and Pi 5, the
canonical Compose stack, embedded containers, unique first-boot state, systemd, and Avahi. Complete
the [physical validation checklist](../product/raspberry-pi-validation.md) before claiming support.

Apple Silicon macOS with Docker Desktop is the supported developer build path; the script supplies a
pinned privileged Linux ARM64 environment and does not require a physical Pi or host-installed Linux
image tools. Raspberry Pi Imager customization for a standalone local Trixie image remains unsupported
and unvalidated; use Ethernet for the first hardware exercise.

The builder host is stable Debian Bookworm even though the generated appliance is Raspberry Pi OS
Trixie. This separates a reproducible supported build environment from the target filesystem and
avoids Docker-layer APT-index loss.

## Application OTA

Application OTA is implemented separately from image/OS updating. Provision an image with a trusted
manifest URL and the matching release public key:

```sh
WHEREHOUSE_UPDATE_MANIFEST_URL=https://releases.example/wherehouse/stable/release.json \
WHEREHOUSE_UPDATE_PUBLIC_KEY_FILE=/secure/wherehouse-release-public.pem \
deploy/raspberry-pi/image/build-image.sh next pi4
```

The signing private key must never be put in the repository or appliance. An image without a public
key intentionally cannot install OTA releases. The host `wherehouse-update.service` persists status
at `/var/lib/wherehouse/config/update-state.json` and exposes only a local Unix socket to the API.
Settings → System can check and install; the host operation continues while web/API containers restart.

See [Application OTA operations](application-ota.md) for building, publishing, recovery, and validation.
