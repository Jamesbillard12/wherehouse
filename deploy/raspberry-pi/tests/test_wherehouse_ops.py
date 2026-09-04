import importlib.util
import os
import tempfile
import unittest
import json
from importlib.machinery import SourceFileLoader
from pathlib import Path
from unittest.mock import MagicMock, patch

MODULE_PATH = Path(__file__).parents[1] / "wherehouse-ops"
SPEC = importlib.util.spec_from_loader(
    "wherehouse_ops", SourceFileLoader("wherehouse_ops", str(MODULE_PATH))
)
assert SPEC and SPEC.loader
ops = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ops)


class FirstBootTests(unittest.TestCase):
    def test_health_status_reports_version_services_storage_and_backup(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(
            ops, "_command_health", return_value="healthy"
        ):
            root = Path(directory)
            (root / "config").mkdir()
            (root / "config/appliance.env").write_text(
                "WHEREHOUSE_VERSION=0.1.1\nAPPLIANCE_IMAGE_VERSION=0.1.1\n"
                "POSTGRES_USER=wherehouse\nPOSTGRES_DB=wherehouse\n"
            )
            status = ops.health_status(root)
        self.assertEqual("0.1.1", status["version"])
        self.assertEqual("healthy", status["services"]["updater"])
        self.assertEqual("internal", status["storage"]["primary"])
        self.assertEqual("none recorded", status["backup"])
    def test_storage_discovery_excludes_root_and_accepts_usb_without_sdx_assumption(self):
        blockdevices = {"blockdevices": [
            {"name": "/dev/mmcblk0", "type": "disk", "size": 32, "tran": None, "serial": "root-disk",
             "children": [{"name": "/dev/mmcblk0p2", "size": 30, "type": "part", "uuid": "root", "mountpoints": ["/"]}]},
            {"name": "/dev/nvme9n1", "type": "disk", "size": 4_000, "tran": "usb", "model": "External SSD", "serial": "usb-123",
             "children": [{"name": "/dev/nvme9n1p1", "size": 4_000, "type": "part", "fstype": "ext4", "uuid": "abcd-1234", "mountpoints": []}]},
        ]}
        with tempfile.TemporaryDirectory() as directory, patch.object(ops, "_json_command", return_value=blockdevices), patch.object(
            ops, "_protected_devices", return_value={"/dev/mmcblk0", "/dev/mmcblk0p2"}
        ):
            devices = ops.list_storage_devices(Path(directory))
        self.assertFalse(devices[0]["selectable"])
        self.assertEqual("Operating system storage is protected", devices[0]["unselectableReason"])
        self.assertTrue(devices[1]["selectable"])
        self.assertEqual("abcd-1234", devices[1]["filesystemUuid"])

    def test_destructive_storage_confirmation_and_uuid_validation_are_strict(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(RuntimeError, "exact confirmation"):
                ops.prepare_storage(Path(directory), "/dev/usb", "/dev/usb", "yes")
            with self.assertRaisesRegex(RuntimeError, "Invalid filesystem UUID"):
                ops.migrate_storage(Path(directory), "$(touch /tmp/nope)")

    def test_nas_is_disabled_by_default_and_credentials_are_validated_before_commands(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.assertFalse(ops.read_storage_state(root)["nas"]["enabled"])
            with self.assertRaisesRegex(RuntimeError, "external primary storage"):
                ops.configure_nas(root, True, "valid_user", "long-enough-password")

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
            "minimumCurrentVersion": "0.1.0", "minimumSchemaRevision": 13,
            "maximumSchemaRevision": 13, "migrationPolicy": "expand-contract",
            "validationScenario": "normal",
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
        with self.assertRaisesRegex(RuntimeError, "migration policy"):
            ops.validate_manifest(dict(manifest, migrationPolicy="destructive"), "1.0.0")
        with self.assertRaisesRegex(RuntimeError, "validation scenario"):
            ops.validate_manifest(dict(manifest, validationScenario="shell"), "1.0.0")

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

    def test_manifest_discovery_rejects_unsupported_installed_schema(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(
            ops, "download"
        ), patch.object(ops, "verify_signature"):
            root = Path(directory)
            (root / "config").mkdir()
            (root / "config/appliance.env").write_text(
                "APPLIANCE_IMAGE_VERSION=1.0.0\nWHEREHOUSE_VERSION=1.0.0\n"
                "WHEREHOUSE_SCHEMA_REVISION=12\nWHEREHOUSE_UPDATE_MANIFEST_URL=https://example.test/release.json\n"
            )
            discovery = root / "releases/discovery"
            discovery.mkdir(parents=True)
            manifest = {
                "schemaVersion": 1, "product": "WhereHouse", "version": "1.1.0",
                "channel": "stable", "architecture": "arm64", "minimumApplianceVersion": "1.0.0",
                "minimumCurrentVersion": "1.0.0", "minimumSchemaRevision": 13,
                "maximumSchemaRevision": 13, "migrationPolicy": "expand-contract",
                "validationScenario": "normal", "runtimeUrl": "https://example.test/runtime.tar",
                "runtimeSha256": "a" * 64, "runtimeSize": 1,
                "publishedAt": "2026-09-04T00:00:00Z", "releaseNotes": "test",
                "requiresReboot": False, "signatureAlgorithm": "rsa-sha256",
            }
            (discovery / "release.json").write_text(json.dumps(manifest))
            with self.assertRaisesRegex(RuntimeError, "database schema"):
                ops.fetch_manifest(root, root / "public.pem")

    def test_signed_health_failure_drill_restores_previous_images_and_version(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            release_dir = root / "releases/1.1.0"
            release_dir.mkdir(parents=True)
            (release_dir / "wherehouse-runtime.tar").touch()
            (release_dir / "release.json").write_text(json.dumps({
                "validationScenario": "fail-health", "maximumSchemaRevision": 13
            }))
            (root / "config").mkdir()
            (root / "config/appliance.env").write_text(
                "APPLIANCE_IMAGE_VERSION=1.0.0\nWHEREHOUSE_VERSION=1.0.0\n"
            )
            completed = MagicMock()
            completed.stdout = "sha256:previous\n"
            with patch.object(ops, "validate_storage"), patch.object(
                ops.subprocess, "run", return_value=completed
            ) as run, patch.object(ops, "compose"), patch.object(ops, "verify_http_services"):
                with self.assertRaisesRegex(RuntimeError, "Previous containers were restored"):
                    ops.install_release(root, "1.1.0")
            state = ops.read_state(root)
            self.assertEqual("failed", state["phase"])
            self.assertTrue(state["rollbackPerformed"])
            self.assertEqual("1.0.0", ops.parse_env(root / "config/appliance.env")["WHEREHOUSE_VERSION"])
            tag_calls = [call for call in run.call_args_list if call.args[0][:2] == ["docker", "tag"]]
            self.assertEqual(4, len(tag_calls))


if __name__ == "__main__":
    unittest.main()
