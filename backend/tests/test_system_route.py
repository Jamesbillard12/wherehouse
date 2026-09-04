import asyncio
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app


def test_system_status_is_public_and_does_not_expose_paths_or_secrets() -> None:
    status = MagicMock()
    status.public_dict.return_value = {
        "ready": True,
        "initialized": False,
        "instance_id": "instance-id",
        "hostname": "wherehouse.local",
        "application_version": "1.0.0",
        "schema_version": "0013",
        "image_version": "1.0.0",
        "build_date": "2026-09-03",
        "device_model": "Raspberry Pi 5",
        "os_version": "Linux",
        "storage": {
            "state": "healthy",
            "mounted": True,
            "writable": True,
            "free_bytes": 1000,
            "total_bytes": 2000,
            "message": "Storage is healthy.",
        },
        "account_count": 0,
        "workspace_count": 0,
    }
    with patch("app.api.v1.routes.system.read_system_status", return_value=status):
        response = TestClient(app).get("/api/v1/system/status")
    assert response.status_code == 200
    payload = response.json()
    assert payload["hostname"] == "wherehouse.local"
    serialized = str(payload).lower()
    assert "password" not in serialized
    assert "/var/lib" not in serialized


def test_update_status_keeps_installed_version_when_updater_is_unavailable() -> None:
    from app.api.v1.routes import system

    with patch.object(system, "update_request", side_effect=system.HTTPException(
        status_code=503, detail="Appliance update service is unavailable"
    )), patch.object(system, "get_settings") as settings:
        settings.return_value.wherehouse_version = "0.1.1"
        settings.return_value.appliance_image_version = "0.1.1"
        payload = asyncio.run(system.update_status(None))
    assert payload["currentVersion"] == "0.1.1"
    assert payload["serviceAvailable"] is False


def test_unavailable_update_status_uses_stable_application_metadata() -> None:
    from app.api.v1.routes import system

    with patch.object(system, "get_settings") as settings:
        settings.return_value.wherehouse_version = "0.1.1"
        settings.return_value.appliance_image_version = "0.1.0"
        payload = system.unavailable_update_status()
    assert payload["currentVersion"] == "0.1.1"
    assert payload["serviceAvailable"] is False
