"""Unit tests for auth service — password hashing & JWT tokens."""

from datetime import timedelta

import pytest

from app.services.auth_service import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


class TestPasswordHashing:
    def test_hash_password_returns_string(self):
        hashed = hash_password("mysecretpassword")
        assert isinstance(hashed, str)
        assert hashed != "mysecretpassword"

    def test_verify_correct_password(self):
        hashed = hash_password("correct-password")
        assert verify_password("correct-password", hashed) is True

    def test_verify_wrong_password(self):
        hashed = hash_password("correct-password")
        assert verify_password("wrong-password", hashed) is False

    def test_different_passwords_produce_different_hashes(self):
        h1 = hash_password("password1")
        h2 = hash_password("password2")
        assert h1 != h2


class TestJWTTokens:
    def test_create_and_decode_token(self):
        user_id = "test-user-123"
        token = create_access_token(user_id)
        payload = decode_access_token(token)
        assert payload is not None
        assert payload["sub"] == user_id

    def test_expired_token_returns_none(self):
        token = create_access_token("user-123", expires_delta=timedelta(seconds=-1))
        payload = decode_access_token(token)
        assert payload is None

    def test_invalid_token_returns_none(self):
        payload = decode_access_token("not-a-valid-token")
        assert payload is None

    def test_tampered_token_returns_none(self):
        token = create_access_token("user-123")
        tampered = token[:-5] + "XXXXX"
        payload = decode_access_token(tampered)
        assert payload is None
