# Release process

The first MVP tag is allowed only after the [execution plan](../product/mvp-execution-plan.md) exit
criteria and [release checklist](../product/mvp-release-checklist.md) are satisfied. Validate fresh
install, upgrade/migrations, primary workflow, physical devices, offline/realtime, restart/reboot,
backup/restore, realistic inventory, errors and documentation. Stabilization fixes release blockers;
it does not add speculative scope.

Application OTA releases use [`./build-release.sh`](../../build-release.sh) and the signed artifact
process in [Application OTA operations](../deployment/application-ota.md). They do not require or imply
a new Raspberry Pi OS image. Never store the release private key in this repository or an appliance.
Production publication is tag-driven through `application-release.yml`, uses the protected
`appliance-release` environment, and runs entirely on GitHub's hosted Ubuntu 24.04 ARM64 runner. No
Raspberry Pi or self-hosted Actions runner is part of the application release path. The workflow
self-verifies the signature and refuses to overwrite an existing `release.json` asset. The Git tag,
manifest version, API runtime version, web bundle version, image tags, appliance version marker, and
UI-reported installed version all derive from the same `X.Y.Z`.
