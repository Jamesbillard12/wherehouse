from __future__ import annotations

import json
import socket
from pathlib import Path


class ApplianceUpdateClient:
    """Narrow transport to the privileged host updater."""

    def __init__(self, socket_path: str):
        self.socket_path = Path(socket_path)

    def request(self, operation: str) -> dict:
        if operation not in {"status", "check", "install"}:
            raise ValueError("Unsupported appliance update operation")
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client:
            client.settimeout(65 if operation == "check" else 5)
            client.connect(str(self.socket_path))
            client.sendall((operation + "\n").encode())
            payload = b""
            while not payload.endswith(b"\n"):
                chunk = client.recv(65536)
                if not chunk:
                    break
                payload += chunk
        response = json.loads(payload)
        if not response.get("ok"):
            raise RuntimeError(response.get("error", "Appliance update operation failed"))
        return response["status"]
