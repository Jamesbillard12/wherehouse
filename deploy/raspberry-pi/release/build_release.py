#!/usr/bin/env python3
"""Build a signed WhereHouse ARM64 application release without building a Pi image."""

from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

SEMVER = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")


def version_tuple(value: str) -> tuple[int, int, int]:
    match = SEMVER.fullmatch(value)
    if not match:
        raise SystemExit(f"Invalid version {value!r}; use X.Y.Z or next")
    return tuple(map(int, match.groups()))


def next_version(output: Path) -> str:
    versions = [version_tuple(path.name) for path in output.iterdir()
                if path.is_dir() and SEMVER.fullmatch(path.name)] if output.exists() else []
    major, minor, patch = max(versions, default=(0, 1, -1))
    return f"{major}.{minor}.{patch + 1}"


def run(command: list[str], cwd: Path) -> None:
    subprocess.run(command, cwd=cwd, check=True)


def main() -> None:
    repository = Path(__file__).resolve().parents[3]
    output = Path(os.environ.get("WHEREHOUSE_RELEASE_OUTPUT_DIR", repository / "dist/releases"))
    requested = sys.argv[1] if len(sys.argv) > 1 else "next"
    version = next_version(output) if requested == "next" else requested
    version_tuple(version)
    if os.environ.get("WHEREHOUSE_ALLOW_DIRTY") != "1":
        run(["git", "diff", "--quiet"], repository)
        run(["git", "diff", "--cached", "--quiet"], repository)
    signing_key = os.environ.get("WHEREHOUSE_RELEASE_SIGNING_KEY")
    base_url = os.environ.get("WHEREHOUSE_RELEASE_BASE_URL")
    if not signing_key or not Path(signing_key).is_file():
        raise SystemExit("WHEREHOUSE_RELEASE_SIGNING_KEY must name the private release key")
    if not base_url or not base_url.startswith("https://"):
        raise SystemExit("WHEREHOUSE_RELEASE_BASE_URL must be a trusted HTTPS directory URL")
    release_dir = output / version
    release_dir.mkdir(parents=True, exist_ok=False)
    api_image, web_image = f"wherehouse-api:{version}", f"wherehouse-web:{version}"
    run(["docker", "build", "--platform", "linux/arm64", "-t", api_image,
         "-f", "backend/Dockerfile", "backend"], repository)
    run(["docker", "build", "--platform", "linux/arm64", "-t", web_image,
         "-f", "deploy/docker/Dockerfile.web", "."], repository)
    runtime = release_dir / f"wherehouse-runtime-{version}.tar"
    run(["docker", "save", "--output", str(runtime), api_image, web_image], repository)
    checksum = hashlib.sha256()
    with runtime.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            checksum.update(chunk)
    digest = checksum.hexdigest()
    (release_dir / f"{runtime.name}.sha256").write_text(f"{digest}  {runtime.name}\n")
    manifest = {
        "schemaVersion": 1, "product": "WhereHouse", "version": version,
        "channel": "stable", "architecture": "arm64",
        "minimumApplianceVersion": os.environ.get("WHEREHOUSE_MINIMUM_APPLIANCE_VERSION", "0.1.0"),
        "runtimeUrl": urljoin(base_url.rstrip("/") + "/", runtime.name),
        "runtimeSha256": digest, "runtimeSize": runtime.stat().st_size,
        "publishedAt": datetime.now(timezone.utc).isoformat(),
        "releaseNotes": os.environ.get("WHEREHOUSE_RELEASE_NOTES", "WhereHouse application update."),
        "requiresReboot": False, "signatureAlgorithm": "rsa-sha256",
    }
    manifest_path = release_dir / "release.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    run(["openssl", "dgst", "-sha256", "-sign", signing_key, "-out",
         str(release_dir / "release.json.sig"), str(manifest_path)], repository)
    expected = [manifest_path, release_dir / "release.json.sig", runtime,
                release_dir / f"{runtime.name}.sha256"]
    if not all(path.is_file() and path.stat().st_size for path in expected):
        raise SystemExit("Release build completed without every expected artifact")
    print(f"Application release complete: {release_dir}")


if __name__ == "__main__":
    main()
