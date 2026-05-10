"""Tests for encryption service — Fernet API key encryption and DEK/KEK vault system."""

import base64
import os
from unittest.mock import patch

import pytest
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.services.encryption import (
    IV_LENGTH,
    KEY_LENGTH,
    PBKDF2_ITERATIONS,
    SALT_LENGTH,
    _derive_kek,
    _encrypt_dek_with_kek,
    create_demo_user_vault,
    decrypt_api_key,
    encrypt_api_key,
    encrypt_demo_field,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def reset_fernet_singleton():
    """Reset the module-level Fernet instance between tests."""
    import app.services.encryption as enc_module
    enc_module._fernet = None
    yield
    enc_module._fernet = None


@pytest.fixture
def master_key():
    """Generate a valid Fernet key for testing."""
    return Fernet.generate_key().decode()


@pytest.fixture
def mock_settings(master_key):
    """Patch settings to use test master key."""
    with patch("app.services.encryption.settings") as mock:
        mock.ENCRYPTION_MASTER_KEY = master_key
        yield mock


# ---------------------------------------------------------------------------
# Fernet API key encryption (used for storing user LLM API keys)
# ---------------------------------------------------------------------------

class TestApiKeyEncryption:
    def test_round_trip(self, mock_settings):
        original = "sk-test-key-12345"
        encrypted = encrypt_api_key(original)
        decrypted = decrypt_api_key(encrypted)
        assert decrypted == original

    def test_different_plaintexts_produce_different_ciphertexts(self, mock_settings):
        a = encrypt_api_key("key-a")
        b = encrypt_api_key("key-b")
        assert a != b

    def test_same_plaintext_produces_different_ciphertexts(self, mock_settings):
        """Fernet includes a timestamp + random IV, so same input != same output."""
        a = encrypt_api_key("same-key")
        b = encrypt_api_key("same-key")
        assert a != b

    def test_empty_string_raises(self, mock_settings):
        with pytest.raises(ValueError, match="empty"):
            encrypt_api_key("")
        with pytest.raises(ValueError, match="empty"):
            decrypt_api_key("")

    def test_wrong_key_fails(self, mock_settings):
        encrypted = encrypt_api_key("my-secret")
        # Switch to a different master key
        wrong_key = Fernet.generate_key().decode()
        mock_settings.ENCRYPTION_MASTER_KEY = wrong_key
        import app.services.encryption as enc_module
        enc_module._fernet = None  # force re-init with new key
        with pytest.raises(ValueError, match="Failed to decrypt"):
            decrypt_api_key(encrypted)

    def test_corrupted_ciphertext_fails(self, mock_settings):
        with pytest.raises(Exception):
            decrypt_api_key("not-valid-base64-ciphertext")

    def test_missing_master_key_raises(self):
        with patch("app.services.encryption.settings") as mock:
            mock.ENCRYPTION_MASTER_KEY = ""
            with pytest.raises(ValueError, match="ENCRYPTION_MASTER_KEY"):
                encrypt_api_key("test")


# ---------------------------------------------------------------------------
# PBKDF2 key derivation
# ---------------------------------------------------------------------------

class TestKeyDerivation:
    def test_same_password_same_salt_produces_same_key(self):
        salt = os.urandom(SALT_LENGTH)
        k1 = _derive_kek("password123", salt)
        k2 = _derive_kek("password123", salt)
        assert k1 == k2

    def test_different_passwords_produce_different_keys(self):
        salt = os.urandom(SALT_LENGTH)
        k1 = _derive_kek("password1", salt)
        k2 = _derive_kek("password2", salt)
        assert k1 != k2

    def test_different_salts_produce_different_keys(self):
        k1 = _derive_kek("same-password", os.urandom(SALT_LENGTH))
        k2 = _derive_kek("same-password", os.urandom(SALT_LENGTH))
        assert k1 != k2

    def test_key_length(self):
        key = _derive_kek("test", os.urandom(SALT_LENGTH))
        assert len(key) == KEY_LENGTH  # 32 bytes = 256 bits


# ---------------------------------------------------------------------------
# DEK encryption with KEK (AES-256-GCM)
# ---------------------------------------------------------------------------

class TestDekEncryption:
    def test_encrypt_decrypt_round_trip(self):
        dek = os.urandom(KEY_LENGTH)
        kek = os.urandom(KEY_LENGTH)
        iv = os.urandom(IV_LENGTH)

        encrypted = _encrypt_dek_with_kek(dek, kek, iv)
        # Decrypt manually to verify
        aesgcm = AESGCM(kek)
        decrypted = aesgcm.decrypt(iv, encrypted, None)
        assert decrypted == dek

    def test_wrong_kek_fails(self):
        dek = os.urandom(KEY_LENGTH)
        kek = os.urandom(KEY_LENGTH)
        wrong_kek = os.urandom(KEY_LENGTH)
        iv = os.urandom(IV_LENGTH)

        encrypted = _encrypt_dek_with_kek(dek, kek, iv)
        aesgcm = AESGCM(wrong_kek)
        with pytest.raises(Exception):
            aesgcm.decrypt(iv, encrypted, None)


# ---------------------------------------------------------------------------
# Demo user vault creation (full pipeline: password -> KEK -> encrypted DEK)
# ---------------------------------------------------------------------------

class TestDemoUserVault:
    def test_vault_has_required_fields(self):
        vault = create_demo_user_vault("demo-password")
        assert "encrypted_dek" in vault
        assert "dek_salt" in vault
        assert "dek_iv" in vault
        assert "raw_dek" in vault

    def test_vault_values_are_base64(self):
        vault = create_demo_user_vault("demo-password")
        for field in ["encrypted_dek", "dek_salt", "dek_iv"]:
            decoded = base64.b64decode(vault[field])
            assert len(decoded) > 0

    def test_salt_and_iv_lengths(self):
        vault = create_demo_user_vault("demo-password")
        salt = base64.b64decode(vault["dek_salt"])
        iv = base64.b64decode(vault["dek_iv"])
        assert len(salt) == SALT_LENGTH  # 16 bytes
        assert len(iv) == IV_LENGTH  # 12 bytes

    def test_raw_dek_length(self):
        vault = create_demo_user_vault("demo-password")
        assert len(vault["raw_dek"]) == KEY_LENGTH  # 32 bytes

    def test_can_decrypt_dek_with_correct_password(self):
        """Full round-trip: create vault, re-derive KEK from password, decrypt DEK."""
        password = "test-password-123"
        vault = create_demo_user_vault(password)

        # Re-derive KEK from password + stored salt
        salt = base64.b64decode(vault["dek_salt"])
        kek = _derive_kek(password, salt)

        # Decrypt the DEK
        iv = base64.b64decode(vault["dek_iv"])
        encrypted_dek = base64.b64decode(vault["encrypted_dek"])
        aesgcm = AESGCM(kek)
        decrypted_dek = aesgcm.decrypt(iv, encrypted_dek, None)

        assert decrypted_dek == vault["raw_dek"]

    def test_wrong_password_cannot_decrypt(self):
        vault = create_demo_user_vault("correct-password")
        salt = base64.b64decode(vault["dek_salt"])
        wrong_kek = _derive_kek("wrong-password", salt)
        iv = base64.b64decode(vault["dek_iv"])
        encrypted_dek = base64.b64decode(vault["encrypted_dek"])

        aesgcm = AESGCM(wrong_kek)
        with pytest.raises(Exception):
            aesgcm.decrypt(iv, encrypted_dek, None)

    def test_each_vault_uses_unique_salt_and_iv(self):
        v1 = create_demo_user_vault("same-password")
        v2 = create_demo_user_vault("same-password")
        assert v1["dek_salt"] != v2["dek_salt"]
        assert v1["dek_iv"] != v2["dek_iv"]
        assert v1["raw_dek"] != v2["raw_dek"]


# ---------------------------------------------------------------------------
# Demo field encryption (encrypts individual values with DEK)
# ---------------------------------------------------------------------------

class TestDemoFieldEncryption:
    def test_string_round_trip(self):
        dek = os.urandom(KEY_LENGTH)
        encrypted = encrypt_demo_field("Hyra", dek)
        # Decrypt manually
        combined = base64.b64decode(encrypted)
        iv = combined[:IV_LENGTH]
        ciphertext = combined[IV_LENGTH:]
        aesgcm = AESGCM(dek)
        plaintext = aesgcm.decrypt(iv, ciphertext, None).decode("utf-8")
        assert plaintext == "Hyra"

    def test_numeric_round_trip(self):
        dek = os.urandom(KEY_LENGTH)
        encrypted = encrypt_demo_field(15000, dek)
        combined = base64.b64decode(encrypted)
        iv = combined[:IV_LENGTH]
        ciphertext = combined[IV_LENGTH:]
        aesgcm = AESGCM(dek)
        plaintext = aesgcm.decrypt(iv, ciphertext, None).decode("utf-8")
        assert plaintext == "15000"

    def test_float_round_trip(self):
        dek = os.urandom(KEY_LENGTH)
        encrypted = encrypt_demo_field(99.50, dek)
        combined = base64.b64decode(encrypted)
        iv = combined[:IV_LENGTH]
        ciphertext = combined[IV_LENGTH:]
        aesgcm = AESGCM(dek)
        plaintext = aesgcm.decrypt(iv, ciphertext, None).decode("utf-8")
        assert plaintext == "99.5"

    def test_swedish_characters(self):
        dek = os.urandom(KEY_LENGTH)
        value = "Försäkring — Länsförsäkringar"
        encrypted = encrypt_demo_field(value, dek)
        combined = base64.b64decode(encrypted)
        iv = combined[:IV_LENGTH]
        ciphertext = combined[IV_LENGTH:]
        aesgcm = AESGCM(dek)
        plaintext = aesgcm.decrypt(iv, ciphertext, None).decode("utf-8")
        assert plaintext == value

    def test_wrong_dek_fails(self):
        dek = os.urandom(KEY_LENGTH)
        wrong_dek = os.urandom(KEY_LENGTH)
        encrypted = encrypt_demo_field("secret", dek)
        combined = base64.b64decode(encrypted)
        iv = combined[:IV_LENGTH]
        ciphertext = combined[IV_LENGTH:]
        aesgcm = AESGCM(wrong_dek)
        with pytest.raises(Exception):
            aesgcm.decrypt(iv, ciphertext, None)

    def test_each_encryption_uses_unique_iv(self):
        dek = os.urandom(KEY_LENGTH)
        a = encrypt_demo_field("same value", dek)
        b = encrypt_demo_field("same value", dek)
        assert a != b  # different IVs -> different ciphertexts
