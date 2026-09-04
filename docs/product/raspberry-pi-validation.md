# Raspberry Pi appliance validation

Record date, commit, image/checksum, Pi model/RAM, boot medium, image version, operator, commands,
timings, and observed result for every row. Automated evidence never completes a physical row. As of
2026-09-03, all physical rows below are **not run**.

For a key-enabled test image, include these first-boot checks:

```sh
ssh -o PasswordAuthentication=no wherehouse@wherehouse.local
whoami
hostname
sudo systemctl --failed
sudo docker compose --env-file /var/lib/wherehouse/config/appliance.env \
  -f /opt/wherehouse/docker-compose.yml \
  -f /opt/wherehouse/deploy/raspberry-pi/compose.appliance.yaml ps
sudo wherehouse-ops status
sudo systemctl status ssh.service wherehouse-update.service wherehouse.service --no-pager
sudo journalctl -u wherehouse-update.service -b --no-pager
```

Confirm `whoami` is `wherehouse`, SSH never prompts for a password, no units are failed, API/web/database
are healthy, Settings → System shows the installed version, and Check for Updates completes cleanly.
After an update and reboot, repeat the SSH and status checks to prove the key and services remain intact.

## Fresh install (repeat on Pi 4 and Pi 5)

- [ ] Verify SHA-256; flash the model-specific `.img.xz` with Raspberry Pi Imager.
- [ ] Boot SD, discover `wherehouse.local`, and complete readiness, account, and household setup with
  no shell intervention.
- [ ] Pair mobile; create locations/item/photo; search, scan, move, and archive.
- [ ] Confirm no fixed OS/app/database/device/pairing credentials exist in the release image.
- [ ] Using a supported Imager/manifest path, validate Wi-Fi, custom hostname, secure SSH choice,
  locale, and timezone; until then use Ethernet and record customization as unsupported.

## Persistence and lifecycle

- [ ] Restart the service and reboot; confirm automatic recovery, unchanged UUID/secrets, persistence,
  and clean PostgreSQL shutdown evidence.
- [ ] Perform a controlled physical power-cycle and record observed recovery (not a guarantee).
- [ ] Crash/restart an application container and confirm normal restart-policy recovery.

## Storage, backup, and restore

- [ ] Boot and operate from supported USB SSD media.
- [ ] In first run, choose internal SD and skip Network Storage; confirm setup completes normally.
- [ ] Attach a USB HDD/SSD; confirm model/capacity and that root, boot, and their parent disk are absent.
- [ ] Cancel the erase warning and verify no change; then type the exact confirmation, prepare ext4,
  migrate, and verify PostgreSQL, uploads, appliance configuration, and OTA state.
- [ ] Reboot with changed USB enumeration order and confirm the UUID-selected disk/data return.
- [ ] Boot once with the configured disk absent and once with a wrong disk; confirm PostgreSQL and
  Samba fail closed with no empty fallback data/share. Reconnect the correct disk and recover.
- [ ] Enable Network Storage in first run and separately after skipping it via Settings. From macOS
  Finder connect to `smb://wherehouse.local/Shared`; from Windows connect to
  `\\wherehouse.local\Shared`. Authenticate, create/read/rename/delete a file, reboot, and verify it.
- [ ] Disable and re-enable SMB; confirm only `Shared` is visible and application data, PostgreSQL,
  configuration, secrets, backups, and OS paths cannot be reached.
- [ ] Test generic external storage: read/write, removal, missing-at-boot, reconnect, permissions,
  low-space, and full-space behavior.
- [ ] Create/verify local, external, and (when credentials exist) Dropbox `.whbackup` artifacts.
- [ ] Restore cleanly and verify workspaces, hierarchy, items, quantities, placements, identifiers,
  and intended media.

## Upgrade and failures

Record `N`, `N+1`, tag/manifest URLs, Pi model, date, tester, backup artifact/checksum, and the output
of these commands before and after each drill (commands are evidence only; the successful normal flow
must still be initiated in Settings → System):

```sh
sudo /opt/wherehouse/deploy/raspberry-pi/wherehouse-ops update-status
sudo docker compose --env-file /var/lib/wherehouse/config/appliance.env \
  -f /opt/wherehouse/docker-compose.yml \
  -f /opt/wherehouse/deploy/raspberry-pi/compose.appliance.yaml ps
sudo journalctl -u wherehouse-update.service --since '30 minutes ago' --no-pager
sudo systemctl reboot
```

Before N→N+1, create a uniquely named item with media, record an owner and paired-device ID, and record
the primary-storage UUID, SMB state, backup provider, and Dropbox connection state. Publish N+1 from a
`vX.Y.Z` tag, check/install solely in Settings → System, permit API/web disconnection, reopen the UI,
and compare every recorded value after completion and again after reboot.

For the deterministic failure drill, build N+2 with
`WHEREHOUSE_RELEASE_VALIDATION_SCENARIO=fail-health`; its signed manifest instructs the updater to fail
after real API/web health checks so the normal rollback path is exercised. Publish it through the same
signing workflow on an isolated trusted manifest endpoint and install from the UI. Do not point
production appliances at an unsigned or mutable endpoint. Capture `phase=failed`,
`rollbackPerformed=true`, the restored N+1
version/images, unchanged recorded state, service health, and a successful retry after restoring the
valid signed source. A migration-failure fixture may be used separately; do not combine an irreversible
migration with the image-rollback drill.

- [ ] Perform the no-SSH/no-SCP/no-reflash physical N → N+1 flow in
  [Application OTA operations](../deployment/application-ota.md); verify remote discovery, publisher
  signature and checksum, backup, migration, API/web health, browser/realtime reconnect, reported app
  version, household/inventory/media persistence, and recorded success.
- [ ] Inject failed health/migration; verify container recovery where schema-compatible and clean
  restore where it is not.
- [ ] Reboot after successful OTA; verify N+1 images/version/data/realtime and a non-stuck update state.
- [ ] Exercise delayed/unavailable PostgreSQL, unavailable/full storage, corrupt backup, unavailable
  network/mDNS, and unavailable Dropbox; confirm visible diagnostics and no state recreation.
