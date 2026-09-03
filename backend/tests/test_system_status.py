from pathlib import Path
from unittest.mock import patch

import pytest

from app.application.system.status import classify_storage, ensure_operation_space


def test_storage_health_classifies_healthy_and_low_space(tmp_path: Path) -> None:
    with patch("app.application.system.status.shutil.disk_usage") as usage:
        usage.return_value.free = 900
        usage.return_value.total = 10_000
        assert classify_storage(tmp_path, 1_000, 500).state == "low_space"
        usage.return_value.free = 400
        assert classify_storage(tmp_path, 1_000, 500).state == "critical"
        usage.return_value.free = 2_000
        assert classify_storage(tmp_path, 1_000, 500).state == "healthy"


def test_dangerous_operation_is_rejected_when_space_is_insufficient(tmp_path: Path) -> None:
    with patch("app.application.system.status.shutil.disk_usage") as usage:
        usage.return_value.free = 100
        with pytest.raises(RuntimeError, match="Insufficient free space"):
            ensure_operation_space(tmp_path, 101)
