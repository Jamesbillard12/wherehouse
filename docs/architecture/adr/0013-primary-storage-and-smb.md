# ADR 0013: UUID-backed appliance storage and isolated SMB sharing

- Status: accepted
- Date: 2026-09-03

## Decision

The appliance keeps `/var/lib/wherehouse` as its stable private application data root. Internal SD
storage uses that directory directly. A selected USB HDD/SSD is formatted ext4, identified and
mounted by filesystem UUID at `/mnt/wherehouse-storage`, and its `application/` directory is bind
mounted at `/var/lib/wherehouse`. `shares/Shared` is a sibling, never a child, of private application
storage. `backups/` is another private sibling and is not exported.

The root/boot backing devices are derived from active mounts and rejected by discovery and again
immediately before formatting. Preparation requires exact destructive confirmation and rechecks the
device identity under the shared lifecycle lock. Migration stops Compose (including PostgreSQL),
copies with numeric ownership, permissions, ACLs and extended attributes, performs a checksum dry
run, writes UUID-based mount configuration, switches the bind mount, restarts, and health-checks.
The SD source is retained. A failed operation restores the internal service path.

The root-owned `wherehouse-ops` daemon alone inspects disks, formats, mounts, changes persistent mount
configuration, manages Samba credentials/configuration, or controls Samba. The API uses an allowlisted
structured runtime Unix socket at `/run/wherehouse/ops.sock`; it has no Docker socket, unrestricted
host path, or shell endpoint. Keeping the socket outside the migrated data root preserves the control
channel while application storage is switched.
Appliance capabilities advertise storage and SMB support; cloud deployments advertise neither.

SMB is opt-in, authenticated with a dedicated single NAS credential, and available only when healthy
external primary storage is mounted. The only generated share is `Shared`. Guest access, symlink
following, arbitrary paths, application data, PostgreSQL, secrets, update state, and backups are
excluded. Internal-SD NAS is deliberately unsupported in MVP to avoid silently consuming the boot
disk. Missing or wrong external storage fails closed: WhereHouse and Samba do not initialize fallback
data or expose a fake share.

Primary storage and backup destinations remain separate. A backup on the same physical disk is not
protection from disk failure, and live PostgreSQL files are never placed in a sync/share directory.

## Consequences

The disk can change Linux enumeration order without changing identity. systemd/fstab ordering replaces
boot sleeps and Samba requires the external mount. Application code stays independent of device paths.
Multiple NAS users, arbitrary shares, ACL management, RAID, snapshots, SMART, NFS, WebDAV, Time
Machine, and storage pools are deferred. Pi disk, power-cycle, missing-drive, and SMB physical tests
remain required before those behaviors can be claimed as physically validated.
