import importlib.util
import tempfile
import unittest
from pathlib import Path

MODULE = Path(__file__).parents[1] / "release/build_release.py"
SPEC = importlib.util.spec_from_file_location("build_release", MODULE)
assert SPEC and SPEC.loader
release = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(release)


class ApplicationReleaseTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
