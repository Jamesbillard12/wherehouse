import importlib.util
import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).parents[3]
SCRIPT = ROOT / "deploy/raspberry-pi/image/build-image.sh"
METADATA_PATH = ROOT / "deploy/raspberry-pi/image/release_metadata.py"
SPEC = importlib.util.spec_from_file_location("release_metadata", METADATA_PATH)
assert SPEC and SPEC.loader
metadata = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(metadata)


class ImageBuilderTests(unittest.TestCase):
    def run_script(self, *arguments: str) -> subprocess.CompletedProcess:
        return subprocess.run(
            [str(SCRIPT), *arguments], cwd=ROOT, text=True, capture_output=True, check=False
        )

    def test_rejects_unsupported_device_before_docker(self):
        result = self.run_script("0.1.0", "pi3")
        self.assertEqual(2, result.returncode)
        self.assertIn("expected pi4 or pi5", result.stderr)

    def test_requires_exactly_version_and_device(self):
        result = self.run_script("0.1.0")
        self.assertEqual(2, result.returncode)
        self.assertIn("Usage:", result.stderr)

    def test_apple_silicon_path_selects_arm64_docker_and_pi_config(self):
        with tempfile.TemporaryDirectory() as directory:
            directory_path = Path(directory)
            log = directory_path / "docker.log"
            docker = directory_path / "docker"
            docker.write_text('#!/bin/sh\nprintf "%s\\n" "$*" >> "$FAKE_DOCKER_LOG"\nexit 0\n')
            docker.chmod(0o755)
            env = {
                **os.environ,
                "DOCKER_BIN": str(docker),
                "FAKE_DOCKER_LOG": str(log),
                "WHEREHOUSE_ALLOW_DIRTY": "1",
                "WHEREHOUSE_TEST_HOST_OS": "Darwin",
                "WHEREHOUSE_TEST_HOST_ARCH": "arm64",
            }
            result = subprocess.run(
                [str(SCRIPT), "0.1.0", "pi5"],
                cwd=ROOT,
                env=env,
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(0, result.returncode, result.stderr)
            calls = log.read_text()
            self.assertIn("build --platform linux/arm64", calls)
            self.assertIn("run --rm --privileged --platform linux/arm64", calls)
            self.assertTrue(calls.rstrip().endswith("0.1.0 pi5"))

    def test_metadata_and_compressed_artifact_checksum(self):
        with tempfile.TemporaryDirectory() as directory:
            artifact = Path(directory) / "wherehouse-pi4-0.1.0.img.xz"
            artifact.write_bytes(b"compressed image")
            metadata.write_release_files(
                artifact, "0.1.0", "pi4", "v2.6.0", "2026-09-03T00:00:00Z"
            )
            checksum = Path(f"{artifact}.sha256").read_text()
            self.assertIn(artifact.name, checksum)
            manifest = json.loads(Path(f"{artifact}.json").read_text())
            self.assertEqual("WhereHouse", manifest["product"])
            self.assertEqual("pi4", manifest["device"])
            self.assertEqual("arm64", manifest["architecture"])
            self.assertEqual("v2.6.0", manifest["imageGeneratorVersion"])


if __name__ == "__main__":
    unittest.main()
