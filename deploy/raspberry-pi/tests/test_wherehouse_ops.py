import importlib.util
from importlib.machinery import SourceFileLoader
import os
import tempfile
import unittest
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
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(ops.shutil, "disk_usage") as usage:
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


if __name__ == "__main__":
    unittest.main()
