# ADR 0011: Package the canonical deployment as a Raspberry Pi appliance

- Status: accepted
- Date: 2026-09-03

## Decision

The preferred MVP self-hosted path is model-specific, flashable Raspberry Pi OS Lite 64-bit images
built reproducibly with `rpi-image-gen`. Each image packages the existing Docker Compose modular
monolith, ARM64 containers, systemd lifecycle, Avahi discovery, and a small host operations utility.
PostgreSQL stays authoritative and application behavior stays in capabilities/APIs. Persistent
instance secrets and identity are generated once on first boot.

The supported developer builder is a pinned, privileged Debian Bookworm Linux ARM64 Docker environment that runs
natively through Docker Desktop on Apple Silicon or on Linux ARM64. It bootstraps `rpi-image-gen` and
all architecture-specific application artifacts inside Linux rather than copying host dependencies.
The upstream v2.6.0 tag is verified against its expected commit. Its dependency manifest is installed
explicitly in one APT layer; upstream dependency installation is not invoked in a later layer.

Administrative SSH is an explicit image-build policy: `key` provisions one supplied public key for
the `wherehouse` account, while `disabled` provisions no login account. The account receives an
unknown, discarded random password hash so sshd does not classify it as OS-locked, while per-user
sshd policy disables password and keyboard-interactive authentication. The generated root filesystem
is validated before compression.

System status is an instance-level, transport-neutral read capability. It may expose nonsensitive
readiness, versions, device model, hostname, counts, and coarse storage health, but never credentials
or server-local paths. Backup artifacts and providers remain unchanged.

## Consequences

Pi 4 and Pi 5 use separate artifacts because upstream generation has hardware-specific device layers.
Application updates replace containers without reflashing; OS/image updates are a separate restore
event. systemd owns host boot/shutdown while Compose owns application dependency health and restart.
There is no second deployment architecture, Pi-only domain API, Kubernetes, fleet manager, or
web-accessible destructive reset.

Physical boot, SSD, power, backup/restore, and upgrade claims remain unvalidated until recorded.
Standalone-image Raspberry Pi Imager customization is also unvalidated and unsupported until an
appropriate manifest/provisioning mechanism and physical Wi-Fi/hostname/SSH/locale tests exist.
