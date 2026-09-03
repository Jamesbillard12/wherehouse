import os
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).parents[3]
SCRIPT = ROOT / "deploy/raspberry-pi/image/build-image.sh"


class ImageVersioningTests(unittest.TestCase):
    def test_next_increments_highest_existing_pi_artifact_version(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            (output / "wherehouse-pi4-0.1.4.img.xz").touch()
            (output / "wherehouse-pi5-0.1.7.img.xz").touch()

            log = output / "docker.log"
            docker = output / "docker"
            docker.write_text(
                '#!/bin/sh\n'
                'printf "%s\\n" "$*" >> "$FAKE_DOCKER_LOG"\n'
                'if [ "$1" = run ]; then\n'
                '  previous=""\n'
                '  last=""\n'
                '  for argument in "$@"; do previous="$last"; last="$argument"; done\n'
                '  version="$previous"\n'
                '  device="$last"\n'
                '  touch "$FAKE_OUTPUT/wherehouse-$device-$version.img.xz"\n'
                '  touch "$FAKE_OUTPUT/wherehouse-$device-$version.img.xz.sha256"\n'
                '  touch "$FAKE_OUTPUT/wherehouse-$device-$version.img.xz.json"\n'
                'fi\n'
                'exit 0\n'
            )
            docker.chmod(0o755)

            env = {
                **os.environ,
                "DOCKER_BIN": str(docker),
                "FAKE_DOCKER_LOG": str(log),
                "FAKE_OUTPUT": directory,
                "WHEREHOUSE_PI_OUTPUT_DIR": directory,
                "WHEREHOUSE_ALLOW_DIRTY": "1",
                "WHEREHOUSE_TEST_HOST_OS": "Darwin",
                "WHEREHOUSE_TEST_HOST_ARCH": "arm64",
            }
            result = subprocess.run(
                [str(SCRIPT), "next", "pi4"],
                cwd=ROOT,
                env=env,
                text=True,
                capture_output=True,
                check=False,
            )

            self.assertEqual(0, result.returncode, result.stderr)
            self.assertIn("Auto-selected next version: 0.1.8", result.stdout)
            self.assertIn("Version: 0.1.8", result.stdout)
            self.assertTrue((output / "wherehouse-pi4-0.1.8.img.xz").is_file())
            self.assertTrue(log.read_text().rstrip().endswith("0.1.8 pi4"))

    def test_next_starts_at_0_1_0_when_no_artifacts_exist(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            docker = output / "docker"
            docker.write_text(
                '#!/bin/sh\n'
                'if [ "$1" = run ]; then\n'
                '  previous=""\n'
                '  last=""\n'
                '  for argument in "$@"; do previous="$last"; last="$argument"; done\n'
                '  touch "$FAKE_OUTPUT/wherehouse-$last-$previous.img.xz"\n'
                '  touch "$FAKE_OUTPUT/wherehouse-$last-$previous.img.xz.sha256"\n'
                '  touch "$FAKE_OUTPUT/wherehouse-$last-$previous.img.xz.json"\n'
                'fi\n'
                'exit 0\n'
            )
            docker.chmod(0o755)
            env = {
                **os.environ,
                "DOCKER_BIN": str(docker),
                "FAKE_OUTPUT": directory,
                "WHEREHOUSE_PI_OUTPUT_DIR": directory,
                "WHEREHOUSE_ALLOW_DIRTY": "1",
                "WHEREHOUSE_TEST_HOST_OS": "Darwin",
                "WHEREHOUSE_TEST_HOST_ARCH": "arm64",
            }
            result = subprocess.run(
                [str(SCRIPT), "next", "pi5"],
                cwd=ROOT,
                env=env,
                text=True,
                capture_output=True,
                check=False,
            )

            self.assertEqual(0, result.returncode, result.stderr)
            self.assertIn("Auto-selected next version: 0.1.0", result.stdout)


if __name__ == "__main__":
    unittest.main()
