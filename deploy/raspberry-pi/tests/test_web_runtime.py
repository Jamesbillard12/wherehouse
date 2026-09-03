import unittest
from pathlib import Path


ROOT = Path(__file__).parents[3]


class WebRuntimeTests(unittest.TestCase):
    def test_web_runtime_avoids_alpine_caddy_on_arm64(self):
        dockerfile = (ROOT / "deploy/docker/Dockerfile.web").read_text()
        nginx_config = (ROOT / "deploy/docker/nginx.conf").read_text()

        self.assertIn("FROM nginx:stable-trixie", dockerfile)
        self.assertNotIn("FROM caddy:2-alpine", dockerfile)
        self.assertIn("COPY deploy/docker/nginx.conf", dockerfile)
        self.assertIn("proxy_pass http://api:8000;", nginx_config)
        self.assertIn("try_files $uri $uri/ /index.html;", nginx_config)


if __name__ == "__main__":
    unittest.main()
