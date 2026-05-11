"""
POST /api/auth/recover-with-code

Anon endpoint. Trades a 12-word recovery phrase for a fresh login password.

The phrase wraps the same DEK the user's regular password wraps. We:
  1. Look up the user's recovery slot by email.
  2. Derive a KEK from the phrase + slot salt (PBKDF2-SHA256, 100k iters).
  3. AES-GCM decrypt the slot's encrypted DEK with that KEK — if this works,
     the phrase is authentic; if it fails, the request is unauthorized.
  4. Re-wrap the recovered DEK with a fresh KEK derived from the new password.
  5. Write the re-wrapped DEK back to user_vault_keys.
  6. Use the Supabase auth admin API to set the new password.

Crypto must mirror frontend/src/services/encryption.ts exactly:
  - PBKDF2-SHA256, 100_000 iterations, 32-byte key
  - AES-GCM, 12-byte random IV, no AAD
  - Salt: 16 random bytes
  - All persisted material is base64-encoded.
"""

from __future__ import annotations

import base64
import re
import secrets
import time
from collections import defaultdict
from typing import Tuple

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.database import get_supabase_client

router = APIRouter()

PBKDF2_ITERATIONS = 100_000
KEY_LENGTH = 32
SALT_LENGTH = 16
IV_LENGTH = 12

# Coarse in-memory rate limit. Real prod deployment should use Redis or a
# request-throttling middleware, but the 128-bit phrase is infeasible to
# brute-force at any rate; this just blunts obvious abuse.
_attempts: dict[str, list[float]] = defaultdict(list)
_MAX_ATTEMPTS_PER_WINDOW = 10
_WINDOW_SECONDS = 60 * 60


def _normalize_recovery_code(code: str) -> str:
    return re.sub(r"\s+", " ", code.strip().lower())


def _derive_kek(password: str, salt: bytes) -> bytes:
    return PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=KEY_LENGTH,
        salt=salt,
        iterations=PBKDF2_ITERATIONS,
    ).derive(password.encode("utf-8"))


def _aes_gcm_decrypt(ciphertext_b64: str, iv_b64: str, key: bytes) -> bytes:
    ciphertext = base64.b64decode(ciphertext_b64)
    iv = base64.b64decode(iv_b64)
    return AESGCM(key).decrypt(iv, ciphertext, None)


def _aes_gcm_encrypt(plaintext: bytes, key: bytes) -> Tuple[str, str]:
    iv = secrets.token_bytes(IV_LENGTH)
    ciphertext = AESGCM(key).encrypt(iv, plaintext, None)
    return (
        base64.b64encode(ciphertext).decode("ascii"),
        base64.b64encode(iv).decode("ascii"),
    )


def _rate_limit_check(ip: str) -> None:
    now = time.monotonic()
    bucket = _attempts[ip]
    cutoff = now - _WINDOW_SECONDS
    bucket[:] = [t for t in bucket if t > cutoff]
    if len(bucket) >= _MAX_ATTEMPTS_PER_WINDOW:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many attempts. Try again later.",
        )
    bucket.append(now)


class RecoverRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    recovery_code: str = Field(min_length=10)
    new_password: str = Field(min_length=8, max_length=200)


@router.post("/recover-with-code", status_code=status.HTTP_200_OK)
def recover_with_code(payload: RecoverRequest, request: Request) -> dict:
    ip = request.client.host if request.client else "unknown"
    _rate_limit_check(ip)

    sb = get_supabase_client()

    user_resp = sb.auth.admin.list_users()
    target_user = next(
        (u for u in (user_resp or []) if (u.email or "").lower() == payload.email.lower()),
        None,
    )
    if target_user is None:
        # Don't leak account existence — return the same generic error
        # auth-validation would emit. Constant-ish timing isn't perfect here
        # but the lookup itself is the slowest part.
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or recovery code")

    user_id = target_user.id

    slot_resp = (
        sb.table("user_vault_recovery_slots")
        .select("encrypted_dek, salt, iv")
        .eq("user_id", user_id)
        .eq("slot_type", "recovery_code")
        .maybe_single()
        .execute()
    )
    slot = (slot_resp.data if slot_resp else None) or None
    if not slot or not slot.get("salt") or not slot.get("iv") or not slot.get("encrypted_dek"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or recovery code")

    normalized_code = _normalize_recovery_code(payload.recovery_code)
    try:
        slot_salt = base64.b64decode(slot["salt"])
        recovery_kek = _derive_kek(normalized_code, slot_salt)
        dek = _aes_gcm_decrypt(slot["encrypted_dek"], slot["iv"], recovery_kek)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or recovery code")

    new_salt = secrets.token_bytes(SALT_LENGTH)
    new_password_kek = _derive_kek(payload.new_password, new_salt)
    new_encrypted_dek, new_iv = _aes_gcm_encrypt(dek, new_password_kek)

    update_vault = (
        sb.table("user_vault_keys")
        .update(
            {
                "encrypted_dek": new_encrypted_dek,
                "dek_salt": base64.b64encode(new_salt).decode("ascii"),
                "dek_iv": new_iv,
            }
        )
        .eq("user_id", user_id)
        .execute()
    )
    if not update_vault.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Couldn't update vault — try again",
        )

    try:
        sb.auth.admin.update_user_by_id(user_id, {"password": payload.new_password})
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Couldn't update password — try again",
        )

    return {"ok": True}
