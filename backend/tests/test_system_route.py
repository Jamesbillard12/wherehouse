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
