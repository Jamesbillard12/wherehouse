# Remote Administration security

Remote Administration is optional, not a dependency of WhereHouse. Browser setup, normal inventory
use, signed application OTA, backup, storage management, and routine recovery work with SSH disabled.

## Threat model and policy

Public images may be inspected by anyone. They contain no maintainer public key, SSH private key,
fixed/default password, or enabled SSH listener. Builds default to `production`; only an explicit
`development` profile plus an explicit public key may create the diagnostic administrator. Private
keys are never accepted. Image-build SSH host keys are removed before packaging and regenerated
uniquely on first boot, so appliances do not share server identity.

An authenticated instance owner may explicitly enable Remote Administration in Settings → System by
supplying one OpenSSH public key. The API forwards it over the allowlisted local appliance-operations
socket. The privileged host utility creates the `wherehouse` administrator, installs
`authorized_keys` as owner-owned `0600` beneath a `0700` directory, enforces public-key-only
authentication, validates sshd, and only then enables the service. Responses and persisted state
contain only the fingerprint, never key material. Disabling stops SSH and removes authorization.

The API container cannot edit arbitrary host paths or execute arbitrary commands. Host configuration
and `/var/lib/wherehouse/config` state are not replaced by ordinary container OTA updates, so
intentional enablement survives OTA. Reflashing requires the owner to enable it again.

## Development, recovery, and support

```sh
WHEREHOUSE_IMAGE_PROFILE=development \
WHEREHOUSE_SSH_MODE=key \
WHEREHOUSE_SSH_PUBLIC_KEY_FILE="$HOME/.ssh/id_ed25519.pub" \
  deploy/raspberry-pi/image/build-image.sh next pi5
```

Public builds omit those variables. Support uses the owner-enabled key, local console, signed OTA,
or documented backup/reflash/restore procedures. There is no universal support password or hidden
maintainer credential.
