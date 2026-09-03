# Raspberry Pi deployment

The appliance build, first-boot, lifecycle, update, reset, storage, and recovery details live in
[`deploy/raspberry-pi/README.md`](../../deploy/raspberry-pi/README.md). They are an implementation
guide, not evidence of a physically validated appliance release.

The implementation uses model-specific Raspberry Pi OS Lite 64-bit images for Pi 4 and Pi 5, the
canonical Compose stack, embedded containers, unique first-boot state, systemd, and Avahi. Complete
the [physical validation checklist](../product/raspberry-pi-validation.md) before claiming support.
