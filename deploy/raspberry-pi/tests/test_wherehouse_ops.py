import importlib.util
import os
import tempfile
import unittest
import json
from importlib.machinery import SourceFileLoader
from pathlib import Path
from unittest.mock import patch

MODULE_PATH = Path(__file__).parents[1] / "wherehouse-ops"
SPEC = importlib.util.spec_from_loader(
    "wherehouse_ops", SourceFileLoader("wherehouse_ops", str(MODULE_PATH))
)
assert SPEC and SPEC.loader
ops = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ops)


class FirstBootTests(unittest.TestCase):
    def test_initialization_is_idempotent_and_persists_secrets(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.assertTrue(ops.initialize(root, "wherehouse", "1.2.3", "2026-09-03"))
            original = (root / "config/appliance.env").read_text()
            self.assertFalse(ops.initialize(root, "different", "9.9.9", "later"))
            self.assertEqual(original, (root / "config/appliance.env").read_text())
            values = ops.parse_env(root / "config/appliance.env")
            self.assertEqual(36, len(values["INSTANCE_ID"]))
            self.assertGreater(len(values["POSTGRES_PASSWORD"]), 30)
            self.assertGreater(len(values["APP_SECRET"]), 60)
            self.assertEqual(0o600, os.stat(root / "config/appliance.env").st_mode & 0o777)

    def test_partial_configuration_is_never_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "config").mkdir()
            (root / "config/appliance.env").write_text("INSTANCE_ID=existing\n")
            with self.assertRaisesRegex(RuntimeError, "Incomplete"):
                ops.initialize(root, "wherehouse", "1", "today")

    def test_low_space_fails_before_startup(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(
            ops.shutil, "disk_usage"
        ) as usage:
            usage.return_value.free = 99
            with self.assertRaisesRegex(RuntimeError, "Insufficient"):
                ops.validate_storage(Path(directory), minimum_free=100)

    def test_container_payload_is_loaded_once(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "config").mkdir()
            with patch.object(ops, "INSTALL_DIR", root), patch.object(
                ops.subprocess, "run"
            ) as run:
                images = root / "deploy/raspberry-pi/images"
                images.mkdir(parents=True)
                (images / "runtime.tar").touch()
                ops.load_images(root)
                ops.load_images(root)
                run.assert_called_once()

    def test_factory_reset_requires_deliberate_confirmation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with self.assertRaisesRegex(RuntimeError, "exact confirmation"):
                ops.factory_reset(root, "yes", delete_backups=False)

    def test_semantic_versions_are_compared_numerically(self):
        self.assertLess(ops.semver("0.1.9"), ops.semver("0.1.10"))
        self.assertGreater(ops.semver("1.0.0"), ops.semver("0.9.99"))
        self.assertEqual(ops.semver("1.0.0"), ops.semver("1.0.0"))

    def test_manifest_rejects_wrong_product_architecture_and_appliance(self):
        manifest = {
            "schemaVersion": 1, "product": "WhereHouse", "version": "0.1.10",
            "channel": "stable", "architecture": "arm64", "minimumApplianceVersion": "0.1.0",
            "runtimeUrl": "https://releases.example/wherehouse-runtime-0.1.10.tar",
            "runtimeSha256": "a" * 64, "runtimeSize": 123, "publishedAt": "2026-09-03T00:00:00Z",
            "releaseNotes": "Safer updates", "requiresReboot": False,
            "signatureAlgorithm": "rsa-sha256",
        }
        self.assertEqual("0.1.10", ops.validate_manifest(manifest, "0.1.0")["version"])
        for field, value in (("product", "Other"), ("architecture", "amd64"),
                             ("channel", "beta"), ("version", "0.1.x")):
            invalid = dict(manifest, **{field: value})
            with self.assertRaises(RuntimeError):
                ops.validate_manifest(invalid, "0.1.0")
        with self.assertRaisesRegex(RuntimeError, "newer appliance"):
            ops.validate_manifest(dict(manifest, minimumApplianceVersion="2.0.0"), "1.0.0")

    def test_download_is_atomic_and_rejects_partial_content(self):
        class Response:
            headers = {"Content-Length": "3"}
            def __enter__(self): return self
            def __exit__(self, *_args): return None
            def read(self, _size=-1):
                data, self.data = getattr(self, "data", b"abc"), b""
                return data
        with tempfile.TemporaryDirectory() as directory, patch.object(
            ops.request, "urlopen", return_value=Response()
        ):
            target = Path(directory) / "runtime.tar"
            ops.download("https://example.test/runtime.tar", target, 3)
            self.assertEqual(b"abc", target.read_bytes())
            self.assertFalse((target.parent / ".runtime.tar.partial").exists())
            with self.assertRaisesRegex(RuntimeError, "does not match"):
                ops.download("https://example.test/runtime.tar", target, 4)

    def test_state_write_is_persistent_and_atomic(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            ops.write_state(root, phase="downloading", progress=42)
            state = json.loads((root / "config/update-state.json").read_text())
            self.assertEqual("downloading", state["phase"])
            self.assertEqual(42, state["progress"])


if __name__ == "__main__":
    unittest.main()
