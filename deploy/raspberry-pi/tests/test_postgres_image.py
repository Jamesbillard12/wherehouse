import unittest
from pathlib import Path

ROOT = Path(__file__).parents[3]


class PiPostgresImageTests(unittest.TestCase):
    def test_pi_runtime_uses_debian_postgres_image(self):
        compose = (ROOT / "docker-compose.yml").read_text()
        entrypoint = (ROOT / "deploy/raspberry-pi/image/docker-entrypoint.sh").read_text()

        self.assertIn("image: postgres:17-bookworm", compose)
        self.assertIn("docker pull --platform linux/arm64 postgres:17-bookworm", entrypoint)
        self.assertIn("postgres:17-bookworm", entrypoint)
        self.assertNotIn("postgres:17-alpine", compose)
        self.assertNotIn("postgres:17-alpine", entrypoint)


if __name__ == "__main__":
    unittest.main()
