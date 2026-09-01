# Raspberry Pi deployment

The current container deployment and environment details live in
[`deploy/raspberry-pi/README.md`](../../deploy/raspberry-pi/README.md). They are an implementation
starting point, not evidence of an MVP-supported appliance install.

The MVP operational target is a documented clean install that applies migrations predictably,
starts and reports health, restarts, recovers after machine reboot, upgrades safely, handles storage
permissions/disk-space failures, backs up and restores, and works with a supported external SSD
configuration. Validate these steps on supported Pi hardware before claiming release readiness.

The desired long-term experience is appliance-like setup/start/stop/restart/status/update/backup/
restore management. Exact commands and packaging remain open; an install script, Docker, Debian
package, Homebrew/Linuxbrew tap, or prebuilt Pi image are possible paths, not current commitments.
