#!/bin/sh
set -eu

repository=$(git rev-parse --show-toplevel)
cd "$repository"

requested="${1:-next}"
publish="${2:-}"

if [ -n "$publish" ] && [ "$publish" != "--publish" ]; then
  echo "Usage: ./build-release.sh [X.Y.Z|next] [--publish]" >&2
  exit 2
fi

if [ "$publish" = "--publish" ]; then
  command -v gh >/dev/null 2>&1 || { echo "GitHub CLI (gh) is required for --publish" >&2; exit 1; }
  command -v openssl >/dev/null 2>&1 || { echo "OpenSSL is required for signed releases" >&2; exit 1; }
  gh auth status >/dev/null 2>&1 || { echo "GitHub CLI is not authenticated; run: gh auth login" >&2; exit 1; }

  current_branch=$(git branch --show-current)
  [ "$current_branch" = "main" ] || { echo "Publishing is only allowed from main (currently $current_branch)" >&2; exit 1; }

  git diff --quiet
  git diff --cached --quiet
  git fetch origin main --tags
  [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || {
    echo "Local main is not identical to origin/main. Run: git pull --ff-only" >&2
    exit 1
  }
fi

if [ "$requested" = "next" ]; then
  version=$(python3 - "$repository" <<'PY'
import re
import subprocess
import sys
from pathlib import Path

root = Path(sys.argv[1])
semver = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")
versions = []

release_root = root / "dist" / "releases"
if release_root.exists():
    for path in release_root.iterdir():
        if path.is_dir() and semver.fullmatch(path.name):
            versions.append(tuple(map(int, path.name.split("."))))

for tag in subprocess.check_output(["git", "tag", "--list", "v*"], cwd=root, text=True).splitlines():
    value = tag[1:] if tag.startswith("v") else tag
    if semver.fullmatch(value):
        versions.append(tuple(map(int, value.split("."))))

major, minor, patch = max(versions, default=(0, 1, -1))
print(f"{major}.{minor}.{patch + 1}")
PY
)
else
  version="$requested"
fi

if [ "$publish" = "--publish" ]; then
  tag="v$version"
  repo_slug=$(gh repo view --json nameWithOwner --jq .nameWithOwner)

  # Published OTA assets are immutable. Fail before doing expensive release work.
  if gh release view "$tag" >/dev/null 2>&1 && \
     gh release view "$tag" --json assets --jq '.assets[].name' | grep -Fxq 'release.json'; then
    echo "Release $tag already has immutable OTA assets; refusing to overwrite" >&2
    exit 1
  fi

  # A stale local tag from a failed publish should not block a retry when no remote tag exists.
  if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
    if [ "$(git rev-list -n 1 "$tag")" != "$(git rev-parse HEAD)" ]; then
      if git ls-remote --exit-code --tags origin "refs/tags/$tag" >/dev/null 2>&1; then
        echo "Remote tag $tag already exists and does not point at the current commit" >&2
        exit 1
      fi
      echo "Removing stale local tag $tag from an earlier failed publish"
      git tag -d "$tag" >/dev/null
    fi
  fi

  signing_key="${WHEREHOUSE_RELEASE_SIGNING_KEY:-$HOME/wherehouse-keys/wherehouse-release-private.pem}"
  verification_key="${WHEREHOUSE_RELEASE_PUBLIC_KEY:-$HOME/wherehouse-keys/wherehouse-release-public.pem}"
  [ -f "$signing_key" ] || {
    echo "Release signing key not found: $signing_key" >&2
    echo "Set WHEREHOUSE_RELEASE_SIGNING_KEY or create $HOME/wherehouse-keys/wherehouse-release-private.pem" >&2
    exit 1
  }

  # When the canonical verification key is available, prove the private key matches it before
  # publishing. This prevents appliances from receiving releases they can never verify.
  if [ -f "$verification_key" ]; then
    private_fingerprint=$(openssl pkey -in "$signing_key" -pubout -outform DER 2>/dev/null | openssl dgst -sha256 | awk '{print $2}')
    public_fingerprint=$(openssl pkey -pubin -in "$verification_key" -outform DER 2>/dev/null | openssl dgst -sha256 | awk '{print $2}')
    if [ -z "$private_fingerprint" ] || [ -z "$public_fingerprint" ] || [ "$private_fingerprint" != "$public_fingerprint" ]; then
      echo "Release signing key does not match appliance verification key: $verification_key" >&2
      exit 1
    fi
    echo "Verified release signing key matches appliance verification key ($private_fingerprint)"
  else
    echo "Warning: appliance verification key not found at $verification_key; skipping local key-pair preflight" >&2
  fi

  # build_release.py deliberately refuses to overwrite a release directory. A previous local
  # publish attempt may have left one behind, so clear it only after immutable remote checks pass.
  if [ -d "$repository/dist/releases/$version" ]; then
    echo "Removing stale local release output: dist/releases/$version"
    rm -rf -- "$repository/dist/releases/$version"
  fi

  export WHEREHOUSE_RELEASE_SIGNING_KEY="$signing_key"
  export WHEREHOUSE_RELEASE_BASE_URL="https://github.com/$repo_slug/releases/download/v$version/"
fi

python3 "$repository/deploy/raspberry-pi/release/build_release.py" "$version"

if [ "$publish" = "--publish" ]; then
  tag="v$version"

  if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
    [ "$(git rev-list -n 1 "$tag")" = "$(git rev-parse HEAD)" ] || {
      echo "Tag $tag already exists but does not point at the current commit" >&2
      exit 1
    }
  else
    git tag -a "$tag" -m "WhereHouse $version"
  fi

  if ! git ls-remote --exit-code --tags origin "refs/tags/$tag" >/dev/null 2>&1; then
    git push origin "$tag"
  fi

  if gh release view "$tag" >/dev/null 2>&1; then
    if gh release view "$tag" --json assets --jq '.assets[].name' | grep -Fxq 'release.json'; then
      echo "Release $tag already has immutable OTA assets; refusing to overwrite" >&2
      exit 1
    fi
  else
    gh release create "$tag" --verify-tag --title "WhereHouse $version" --generate-notes
  fi

  gh release upload "$tag" "$repository/dist/releases/$version"/*
  echo "Published WhereHouse $version: https://github.com/$repo_slug/releases/tag/$tag"
fi
