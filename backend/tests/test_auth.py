"""Tests for JWT verification and admin secret gating."""

import time
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from jose import jwt

from app.auth import (
    AuthenticatedUser,
    get_current_user,
    require_admin_secret,
    verify_household_member,
)


JWT_SECRET = "test-secret-do-not-use-in-prod"


def _make_token(payload: dict, secret: str = JWT_SECRET, algorithm: str = "HS256") -> str:
    base = {
        "sub": "user-123",
        "email": "user@example.com",
        "aud": "authenticated",
        "iat": int(time.time()),
        "exp": int(time.time()) + 3600,
    }
    base.update(payload)
    return jwt.encode(base, secret, algorithm=algorithm)


@pytest.fixture(autouse=True)
def patch_jwt_secret():
    with patch("app.auth.settings") as mock:
        mock.JWT_SECRET = JWT_SECRET
        mock.ADMIN_SECRET = "admin-secret"
        yield mock


def _creds(token: str) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


# ---------------------------------------------------------------------------
# get_current_user
# ---------------------------------------------------------------------------

class TestGetCurrentUser:
    def test_valid_token_returns_user(self):
        token = _make_token({})
        user = get_current_user(_creds(token))
        assert isinstance(user, AuthenticatedUser)
        assert user.id == "user-123"
        assert user.email == "user@example.com"

    def test_missing_credentials_rejected(self):
        with pytest.raises(HTTPException) as exc:
            get_current_user(None)
        assert exc.value.status_code == 401

    def test_empty_token_rejected(self):
        with pytest.raises(HTTPException) as exc:
            get_current_user(_creds(""))
        assert exc.value.status_code == 401

    def test_garbage_token_rejected(self):
        with pytest.raises(HTTPException) as exc:
            get_current_user(_creds("not-a-real-jwt"))
        assert exc.value.status_code == 401

    def test_wrong_secret_rejected(self):
        token = _make_token({}, secret="some-other-secret")
        with pytest.raises(HTTPException) as exc:
            get_current_user(_creds(token))
        assert exc.value.status_code == 401

    def test_expired_token_rejected(self):
        token = _make_token({"exp": int(time.time()) - 60})
        with pytest.raises(HTTPException) as exc:
            get_current_user(_creds(token))
        assert exc.value.status_code == 401

    def test_wrong_audience_rejected(self):
        token = _make_token({"aud": "service_role"})
        with pytest.raises(HTTPException) as exc:
            get_current_user(_creds(token))
        assert exc.value.status_code == 401

    def test_alg_none_rejected(self):
        unsigned = jwt.encode({"sub": "attacker", "aud": "authenticated"}, "", algorithm="HS256")
        header, payload, _ = unsigned.split(".")
        with pytest.raises(HTTPException) as exc:
            get_current_user(_creds(f"{header}.{payload}."))
        assert exc.value.status_code == 401

    def test_missing_sub_rejected(self):
        token = _make_token({"sub": None})
        with pytest.raises(HTTPException) as exc:
            get_current_user(_creds(token))
        assert exc.value.status_code == 401


# ---------------------------------------------------------------------------
# verify_household_member
# ---------------------------------------------------------------------------

class TestVerifyHouseholdMember:
    def _patch_supabase(self, member_rows: list[dict]):
        client = MagicMock()
        chain = client.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value
        chain.execute.return_value = MagicMock(data=member_rows)
        return patch("app.auth.get_supabase_client", return_value=client)

    def test_member_passes(self):
        with self._patch_supabase([{"user_id": "user-1"}]):
            verify_household_member("user-1", "household-1")  # no exception

    def test_non_member_rejected_with_404(self):
        with self._patch_supabase([]):
            with pytest.raises(HTTPException) as exc:
                verify_household_member("user-1", "household-1")
            assert exc.value.status_code == 404


# ---------------------------------------------------------------------------
# require_admin_secret
# ---------------------------------------------------------------------------

class TestRequireAdminSecret:
    def test_correct_secret_passes(self):
        require_admin_secret("admin-secret")  # no exception

    def test_wrong_secret_rejected(self):
        with pytest.raises(HTTPException) as exc:
            require_admin_secret("guessed-secret")
        assert exc.value.status_code == 401

    def test_missing_header_rejected(self):
        with pytest.raises(HTTPException) as exc:
            require_admin_secret(None)
        assert exc.value.status_code == 401

    def test_unconfigured_admin_secret_denies_all(self, patch_jwt_secret):
        patch_jwt_secret.ADMIN_SECRET = ""
        with pytest.raises(HTTPException) as exc:
            require_admin_secret("anything")
        assert exc.value.status_code == 503
