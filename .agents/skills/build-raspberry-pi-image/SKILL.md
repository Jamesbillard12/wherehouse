---
name: build-raspberry-pi-image
description: Build WhereHouse Raspberry Pi 4 and Pi 5 appliance images through the repository's protected GitHub Actions workflow. Use when asked to create, generate, rebuild, or inspect a WhereHouse Pi image or its downloadable artifacts; do not use for application-only OTA releases.
---

# Build a WhereHouse Raspberry Pi image

Use the checked-in image pipeline; do not reproduce `rpi-image-gen` commands or install Linux image
packages on the host. Read these files before acting because they are the maintained source of truth:

- `deploy/raspberry-pi/README.md` for the image contract, outputs, profiles, and limitations.
- `.github/workflows/pi-image.yml` for the current GitHub runner, matrix, environment, and secret.
- `docs/product/raspberry-pi-validation.md` when the request includes flashing or hardware validation.

## Choose the build path

Prefer the remote GitHub build unless the user explicitly asks for a local build. The remote workflow
builds both Pi 4 and Pi 5 production images from `main` on GitHub's hosted ARM64 runner. A local build
is appropriate for builder development or an explicitly requested development-profile image and
requires Apple Silicon macOS plus Docker Desktop.

An application-only OTA release is a different operation. If the user asks for an update that does
not require reflashing Raspberry Pi OS, follow `docs/deployment/application-ota.md` instead.

## Remote production build

1. Inspect `git status --short --branch`, the current branch, and the relevant commits. The workflow
   always checks out remote `main`; uncommitted changes and commits not present on remote `main` will
   not be included. State this clearly and do not push, merge, or switch branches unless requested.
2. Use the requested semantic version. If none is given, use `next`; the checked-in builder resolves it
   from local image artifacts and fetched GitHub release tags. Never guess a release number from memory.
3. Confirm `gh auth status` succeeds and that `.github/workflows/pi-image.yml` exists. The protected
   `appliance-release` environment must provide `WHEREHOUSE_RELEASE_PUBLIC_KEY_PEM`; never request,
   print, download, or materialize the private signing key for an image build.
4. Dispatch and watch with `pnpm pi:build:remote:watch <version>`. Starting the workflow is an
   external mutation, so do it only when the user has asked to create/build the image. If GitHub
   authentication or environment approval blocks the run, report the precise remediation and stop;
   do not fall back to a local production build without the user's direction.
5. Identify the dispatched run by URL/ID and verify its conclusion rather than treating successful
   dispatch as a successful build. If the wrapper cannot reliably identify the run, use `gh run list`
   and correlate workflow, branch, event, creation time, and requested version before watching it.
6. On failure, inspect the failed step with `gh run view <run-id> --log-failed`, summarize the concrete
   cause, and make no success claim. Do not repeatedly dispatch equivalent runs without correcting a
   transient or code/configuration cause.
7. On success, inspect the run's artifacts with `gh run view <run-id>` or the GitHub API. Report the
   run URL, source commit, resolved version, and separate Pi 4/Pi 5 artifact names. Download artifacts
   only when the user asks for local copies; use `gh run download <run-id> --dir dist/pi/remote-<run-id>`
   so existing local outputs are not overwritten.
8. For downloaded images, verify every `.img.xz` against its adjacent `.sha256` and inspect the JSON
   metadata. Report paths and checksum results. Do not modify generated artifacts.

## Local build

Read `deploy/raspberry-pi/README.md`, confirm the supported host and Docker daemon, and preserve the
builder's clean-worktree requirement. Use `pnpm pi:build -- <pi4|pi5>` for the ordinary next-version
OTA-enabled build, or `pnpm pi:image -- <version|next> <pi4|pi5>` only when explicit low-level inputs
are required. Never inject a developer key into a production-profile image. Never pass an SSH private
key or the release-signing private key.

## Completion and evidence

A completed GitHub Actions run proves only that image construction and automated root-filesystem
checks passed. It does not prove that the image was flashed, booted, or validated on Pi 4/Pi 5
hardware. Keep those claims separate and use `docs/product/raspberry-pi-validation.md` for physical
evidence. Do not update validation status documents unless the requested validation was actually run
and its date, commit, artifacts, hardware, commands, and results were recorded.
