# Storage and backup architecture

Primary application storage and backup destinations are different concerns.

Primary storage is live PostgreSQL data plus media in a configured local filesystem, external SSD,
or S3-compatible object store. A backup destination stores portable, point-in-time archives: local
disk, external SSD, NAS/SMB/NFS, S3-compatible storage, Dropbox, Backblaze B2, OneDrive, Google Drive,
or a future provider.

Never place live PostgreSQL data files in Dropbox, Google Drive, OneDrive, or another consumer
filesystem-sync directory. File synchronization is not PostgreSQL replication. Such services may
receive completed backup archives or be accessed through an intentional media/provider adapter.

## Boundary

Conceptually, backup orchestration owns consistent database snapshotting, included media, manifest,
application/schema versions, checksums and integrity validation, optional encryption, retention,
restore semantics, compatibility checks and verification. A provider primarily stores, lists,
retrieves and deletes completed archives. Do not add speculative production interfaces until the
first implementation needs them.

Archives must remain portable across providers. A name such as
`wherehouse-YYYY-MM-DD.whbackup` is illustrative, not a frozen format. Restore is destructive and
must require explicit confirmation, preflight validation, clear failure semantics, and preferably a
recoverable pre-restore snapshot. Secrets should be deliberately excluded or separately protected.

## MVP and evolution

MVP needs one supported, tested local-filesystem or external-SSD backup and restore path. A realistic
database plus media must restore into a clean/test environment. NAS and cloud providers are
post-MVP adapters over the same semantics.

A recommended future Pi arrangement is Raspberry Pi OS/application on the system disk and correctly
configured PostgreSQL data, media, and local backups on an external SSD, optionally copied remotely.
This is guidance, not a hard-coded path or mandatory topology. Setup tooling may later detect disks;
automatic provisioning is not required for MVP.
