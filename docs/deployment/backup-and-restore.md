# Backup and restore operations

Backup/restore is an MVP release gate but is not implemented at the current assessment point. Follow
the required semantics in [storage and backup architecture](../architecture/storage-and-backup.md)
and the validation in the [release checklist](../product/mvp-release-checklist.md).

The eventual runbook must state prerequisites, destination configuration, included/excluded data,
encryption and secret handling, backup creation/list/verification, clean restore, destructive
confirmation, version compatibility, failure recovery, retention, and a periodic restore drill.
Do not document copying a running PostgreSQL data directory as a valid backup.
