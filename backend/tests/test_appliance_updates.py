import json

import pytest

from app.infrastructure.appliance_updates import ApplianceUpdateClient


def test_update_client_allows_only_fixed_operations(tmp_path) -> None:
    with pytest.raises(ValueError):
        ApplianceUpdateClient(str(tmp_path / "update.sock")).request("shell rm")


def test_update_client_uses_narrow_json_socket_protocol(monkeypatch) -> None:
    class FakeSocket:
        sent = b""
        def __enter__(self): return self
        def __exit__(self, *_args): return None
        def settimeout(self, _timeout): pass
        def connect(self, path): assert path == "/data/config/update.sock"
        def sendall(self, value): self.sent = value
        def recv(self, _size):
            assert self.sent == b"status\n"
            return (json.dumps({"ok": True, "status": {"phase": "idle"}}) + "\n").encode()

    fake = FakeSocket()
    monkeypatch.setattr("app.infrastructure.appliance_updates.socket.socket", lambda *_args: fake)
    assert ApplianceUpdateClient("/data/config/update.sock").request("status") == {"phase": "idle"}


def test_update_client_sends_only_typed_policy_payload(monkeypatch) -> None:
    class FakeSocket:
        sent = b""
        def __enter__(self): return self
        def __exit__(self, *_args): return None
        def settimeout(self, _timeout): pass
        def connect(self, _path): pass
        def sendall(self, value): self.sent = value
        def recv(self, _size):
            request = json.loads(self.sent)
            assert request == {"operation": "update_policy.set", "policy": "off"}
            return b'{"ok": true, "status": {"policy": "off"}}\n'

    monkeypatch.setattr("app.infrastructure.appliance_updates.socket.socket", lambda *_args: FakeSocket())
    assert ApplianceUpdateClient("/data/config/update.sock").request(
        "update_policy.set", {"policy": "off"}
    ) == {"policy": "off"}
