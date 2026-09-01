from app.application.identifiers.capabilities import identifier_payload


def test_identifier_payload_is_versioned_and_opaque() -> None:
    payload = identifier_payload("idn_example-token")
    assert payload == "wherehouse://identify/v1/idn_example-token"
    assert "household" not in payload
