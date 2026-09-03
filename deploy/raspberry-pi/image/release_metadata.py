#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def checksum(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_release_files(
    artifact: Path,
    version: str,
    device: str,
    generator_version: str,
    build_date: str,
    checksum_only: bool = False,
) -> None:
    digest = checksum(artifact)
    artifact.with_suffix(artifact.suffix + ".sha256").write_text(f"{digest}  {artifact.name}\n")
    if checksum_only:
        return
    metadata = {
        "product": "WhereHouse",
        "version": version,
        "applicationVersion": version,
        "device": device,
        "hardware": [f"Raspberry Pi {device.removeprefix('pi')}"],
        "architecture": "arm64",
        "base": "Raspberry Pi OS Lite 64-bit (Trixie)",
        "buildDate": build_date,
        "imageGenerator": "rpi-image-gen",
        "imageGeneratorVersion": generator_version,
    }
    artifact.with_suffix(artifact.suffix + ".json").write_text(
        json.dumps(metadata, indent=2, sort_keys=True) + "\n"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("artifact", type=Path)
    parser.add_argument("version")
    parser.add_argument("device")
    parser.add_argument("generator_version")
    parser.add_argument("build_date")
    parser.add_argument("--checksum-only", action="store_true")
    args = parser.parse_args()
    write_release_files(args.artifact, args.version, args.device, args.generator_version, args.build_date, args.checksum_only)


if __name__ == "__main__":
    main()
