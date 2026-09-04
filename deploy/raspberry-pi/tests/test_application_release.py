import importlib.util
import tempfile
import unittest
from pathlib import Path

MODULE = Path(__file__).parents[1] / "release/build_release.py"
ROOT = Path(__file__).parents[3]
SPEC = importlib.util.spec_from_file_location("build_release", MODULE)
assert SPEC and SPEC.loader
release = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(release)


class ApplicationReleaseTests(unittest.TestCase):
    def test_release_workflow_uses_hosted_arm64_with_explicit_tools(self):
        workflow = (ROOT / ".github/workflows/application-release.yml").read_text()

        self.assertIn("runs-on: ubuntu-24.04-arm", workflow)
        self.assertNotIn("runs-on: [self-hosted, Linux, ARM64]", workflow)
        self.assertIn("uses: actions/setup-node@v4", workflow)
        self.assertIn("uses: astral-sh/setup-uv@v6", workflow)
        self.assertIn("uv python install 3.13", workflow)
        self.assertIn("docker info >/dev/null", workflow)

    def test_release_workflow_preserves_signing_and_immutable_publication(self):
        workflow = (ROOT / ".github/workflows/application-release.yml").read_text()

        self.assertIn("environment: appliance-release", workflow)
        self.assertIn("secrets.WHEREHOUSE_RELEASE_SIGNING_KEY_PEM", workflow)
        self.assertIn("Validate immutable tag", workflow)
        self.assertIn("git tag --points-at HEAD", workflow)
        self.assertIn("Remove materialized signing key", workflow)
        self.assertIn("gh release upload", workflow)

    def test_next_version_uses_semantic_order(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            (output / "0.1.9").mkdir()
            (output / "0.1.10").mkdir()
            self.assertEqual("0.1.11", release.next_version(output))

    def test_invalid_versions_are_rejected(self):
        for value in ("1.2", "1.2.3.4", "v1.2.3", "1.02.3", "../1.2.3"):
            with self.assertRaises(SystemExit):
                release.version_tuple(value)

    def test_tag_and_plain_versions_have_one_canonical_value(self):
        self.assertEqual("1.2.3", release.version_from_ref("v1.2.3"))
        self.assertEqual("1.2.3", release.version_from_ref("1.2.3"))


if __name__ == "__main__":
    unittest.main()
