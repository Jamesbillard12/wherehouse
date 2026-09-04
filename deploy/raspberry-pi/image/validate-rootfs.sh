#!/bin/sh
set -eu

rootfs=${1:?root filesystem path is required}
version=${2:?image version is required}
ssh_mode=${3:?SSH mode is required}
expected_key_file=${4:-}
update_mode=${5:?update mode is required}

fail() { echo "WhereHouse image validation failed: $*" >&2; exit 1; }
require_file() { [ -f "$rootfs$1" ] || fail "missing $1"; }
require_executable() { [ -x "$rootfs$1" ] || fail "$1 is not executable"; }
require_enabled() {
  unit=$1
  find "$rootfs/etc/systemd/system" -type l -name "$unit" -print -quit | grep -q . ||
    fail "$unit is not enabled"
}

require_file /etc/wherehouse-image
grep -qx "WHEREHOUSE_IMAGE_VERSION=$version" "$rootfs/etc/wherehouse-image" ||
  fail "/etc/wherehouse-image has the wrong version"
require_file /opt/wherehouse/docker-compose.yml
require_file /opt/wherehouse/deploy/raspberry-pi/compose.appliance.yaml
require_executable /opt/wherehouse/deploy/raspberry-pi/wherehouse-ops
[ -L "$rootfs/usr/local/bin/wherehouse-ops" ] || fail "wherehouse-ops command symlink is missing"
require_executable /opt/wherehouse/deploy/raspberry-pi/wherehouse-backup
require_file /opt/wherehouse/deploy/raspberry-pi/images/wherehouse-runtime.tar
for unit in wherehouse.service wherehouse-update.service wherehouse-avahi.service; do
  require_file "/etc/systemd/system/$unit"
  require_enabled "$unit"
done
require_enabled docker.service
require_enabled ssh.service
require_file /usr/sbin/sshd
grep -q '^RuntimeDirectoryPreserve=yes$' "$rootfs/etc/systemd/system/wherehouse-update.service" ||
  fail "updater runtime directory is not restart-stable"
grep -q 'Requires=.*wherehouse-update.service' "$rootfs/etc/systemd/system/wherehouse.service" ||
  fail "application service does not require the updater"

case "$ssh_mode" in
  key)
    [ -n "$expected_key_file" ] || fail "key SSH mode has no expected public key"
    grep -q '^wherehouse:' "$rootfs/etc/passwd" || fail "wherehouse user is missing"
    home="$rootfs/home/wherehouse"
    require_file /home/wherehouse/.ssh/authorized_keys
    cmp -s "$expected_key_file" "$home/.ssh/authorized_keys" || fail "authorized_keys does not contain the supplied key"
    uid=$(awk -F: '$1 == "wherehouse" { print $3 }' "$rootfs/etc/passwd")
    gid=$(awk -F: '$1 == "wherehouse" { print $4 }' "$rootfs/etc/passwd")
    [ "$(stat -c %u:%g "$home/.ssh")" = "$uid:$gid" ] || fail ".ssh ownership is incorrect"
    [ "$(stat -c %a "$home/.ssh")" = 700 ] || fail ".ssh permissions are not 0700"
    [ "$(stat -c %u:%g "$home/.ssh/authorized_keys")" = "$uid:$gid" ] || fail "authorized_keys ownership is incorrect"
    [ "$(stat -c %a "$home/.ssh/authorized_keys")" = 600 ] || fail "authorized_keys permissions are not 0600"
    password_field=$(awk -F: '$1 == "wherehouse" { print $2 }' "$rootfs/etc/shadow")
    case "$password_field" in ''|'!'*|'*'*) fail "wherehouse account is locked or has no password hash" ;; esac
    require_file /etc/ssh/sshd_config.d/90-wherehouse-admin.conf
    grep -q '^[[:space:]]*PubkeyAuthentication yes$' "$rootfs/etc/ssh/sshd_config.d/90-wherehouse-admin.conf" ||
      fail "public-key authentication is not enabled for wherehouse"
    ;;
  disabled)
    [ ! -e "$rootfs/home/wherehouse/.ssh/authorized_keys" ] || fail "SSH key present in disabled mode"
    ;;
  *) fail "unknown SSH mode $ssh_mode" ;;
esac

case "$update_mode" in
  enabled)
    require_file /opt/wherehouse/deploy/raspberry-pi/update-public-key.pem
    grep -Eq '^WHEREHOUSE_UPDATE_MANIFEST_URL=https://.+' "$rootfs/etc/wherehouse-image" ||
      fail "enabled updater has no HTTPS manifest URL"
    ;;
  disabled)
    [ ! -e "$rootfs/opt/wherehouse/deploy/raspberry-pi/update-public-key.pem" ] ||
      fail "update key present in disabled mode"
    ;;
  *) fail "unknown update mode $update_mode" ;;
esac

echo "WhereHouse image root filesystem validation passed"
