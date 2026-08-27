import pytest
from pydantic import ValidationError

from app.core.security import hash_password, new_token, token_hash, verify_password
from app.main import app
from app.schemas.auth import PairingConsume, RegisterRequest


def test_password_hash_is_salted_and_verifiable() -> None:
    first = hash_password("correct horse battery staple")
    second = hash_password("correct horse battery staple")

    assert first != second
    assert "correct horse battery staple" not in first
    assert verify_password("correct horse battery staple", first)
    assert not verify_password("wrong password", first)


def test_tokens_have_scoped_prefixes_and_stable_hashes() -> None:
    pairing_token = new_token("pair")

    assert pairing_token.startswith("pair_")
    assert len(pairing_token) >= 40
    assert token_hash(pairing_token) == token_hash(pairing_token)
    assert pairing_token not in token_hash(pairing_token)


def test_auth_payloads_enforce_minimum_password_and_device_identity() -> None:
    registration = RegisterRequest(
        email="owner@example.com",
        display_name="Owner",
        password="long-enough-password",
    )
    pairing = PairingConsume(
        token=new_token("pair"),
        device_name="Garage phone",
        device_type="phone",
    )

    assert registration.email == "owner@example.com"
    assert pairing.device_type.value == "phone"


def test_registration_password_requires_ten_characters() -> None:
    registration = RegisterRequest(
        email="owner@example.com",
        display_name="Owner",
        password="1234567890",
    )
    assert registration.password == "1234567890"

    with pytest.raises(ValidationError):
        RegisterRequest(
            email="owner@example.com",
            display_name="Owner",
            password="123456789",
        )


def test_auth_and_pairing_routes_are_exposed() -> None:
    paths = set(app.openapi()["paths"])

    assert "/api/v1/auth/register" in paths
    assert "/api/v1/auth/login" in paths
    assert "/api/v1/pairing/consume" in paths
