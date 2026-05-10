"""Encryption service for backend API key management using Fernet."""

import os
import base64
import logging
from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from app.config import settings

logger = logging.getLogger(__name__)

# Initialize Fernet cipher with master key from environment
_fernet: Fernet | None = None


def _get_fernet() -> Fernet:
    """Get or create Fernet cipher instance."""
    global _fernet
    if _fernet is None:
        if not settings.ENCRYPTION_MASTER_KEY:
            raise ValueError(
                "ENCRYPTION_MASTER_KEY not configured. "
                "Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
            )
        try:
            _fernet = Fernet(settings.ENCRYPTION_MASTER_KEY.encode())
        except Exception as e:
            logger.error(f"Invalid ENCRYPTION_MASTER_KEY format: {e}")
            raise ValueError("Invalid ENCRYPTION_MASTER_KEY format. Must be a valid Fernet key.")
    return _fernet


def encrypt_api_key(plaintext: str) -> str:
    """
    Encrypt an API key using the backend master key.
    
    Args:
        plaintext: The API key to encrypt
        
    Returns:
        Base64-encoded encrypted string
    """
    if not plaintext:
        raise ValueError("Cannot encrypt empty string")
    
    fernet = _get_fernet()
    encrypted = fernet.encrypt(plaintext.encode())
    return encrypted.decode()


def decrypt_api_key(ciphertext: str) -> str:
    """
    Decrypt an API key using the backend master key.
    
    Args:
        ciphertext: The encrypted API key (base64-encoded)
        
    Returns:
        Decrypted plaintext API key
        
    Raises:
        ValueError: If decryption fails (invalid key or corrupted data)
    """
    if not ciphertext:
        raise ValueError("Cannot decrypt empty string")
    
    fernet = _get_fernet()
    try:
        decrypted = fernet.decrypt(ciphertext.encode())
        return decrypted.decode()
    except InvalidToken:
        logger.error("Failed to decrypt API key - invalid token or wrong master key")
        raise ValueError("Failed to decrypt API key. The encryption key may have changed.")


# =============================================================================
# Demo User Vault Encryption
# 
# Creates encrypted vault keys compatible with frontend Web Crypto API.
# Uses same algorithms and parameters as frontend encryption.ts:
# - PBKDF2 (100,000 iterations, SHA-256) for KEK derivation
# - AES-256-GCM for DEK encryption
# =============================================================================

# Must match frontend constants in encryption.ts
PBKDF2_ITERATIONS = 100000
SALT_LENGTH = 16
IV_LENGTH = 12
KEY_LENGTH = 32  # 256 bits = 32 bytes


def _derive_kek(password: str, salt: bytes) -> bytes:
    """Derive Key Encryption Key from password using PBKDF2."""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=KEY_LENGTH,
        salt=salt,
        iterations=PBKDF2_ITERATIONS,
    )
    return kdf.derive(password.encode('utf-8'))


def _encrypt_dek_with_kek(dek: bytes, kek: bytes, iv: bytes) -> bytes:
    """Encrypt DEK using KEK with AES-GCM."""
    aesgcm = AESGCM(kek)
    return aesgcm.encrypt(iv, dek, None)


def create_demo_user_vault(password: str) -> dict:
    """
    Create encryption vault keys for a demo user.
    Matches frontend createUserEncryptionKeys() exactly.
    
    Args:
        password: The demo user's password (already generated)
        
    Returns:
        dict with:
        - encrypted_dek: base64 encoded encrypted DEK
        - dek_salt: base64 encoded salt
        - dek_iv: base64 encoded IV
        - raw_dek: raw DEK bytes (for encrypting seed data, not stored)
    """
    # Generate random salt, IV, and DEK
    salt = os.urandom(SALT_LENGTH)
    iv = os.urandom(IV_LENGTH)
    dek = os.urandom(KEY_LENGTH)
    
    # Derive KEK from password
    kek = _derive_kek(password, salt)
    
    # Encrypt DEK with KEK
    encrypted_dek = _encrypt_dek_with_kek(dek, kek, iv)
    
    logger.info("Created demo user vault with PBKDF2 + AES-256-GCM")
    
    return {
        "encrypted_dek": base64.b64encode(encrypted_dek).decode('utf-8'),
        "dek_salt": base64.b64encode(salt).decode('utf-8'),
        "dek_iv": base64.b64encode(iv).decode('utf-8'),
        "raw_dek": dek,  # Keep raw DEK for encrypting seed data
    }


def encrypt_demo_field(value: str | int | float, dek: bytes) -> str:
    """
    Encrypt a single field value using the DEK.
    Output format matches frontend encryptData() in encryption.ts:
    - Base64 encoded: IV (12 bytes) + ciphertext + auth tag (16 bytes)
    
    Args:
        value: The plaintext value to encrypt (str, int, or float)
        dek: The raw Data Encryption Key (32 bytes)
        
    Returns:
        Base64-encoded string: iv + ciphertext + tag
    """
    # Convert value to string
    plaintext = str(value)
    
    # Generate random IV for this field
    iv = os.urandom(IV_LENGTH)
    
    # Encrypt with AES-GCM
    aesgcm = AESGCM(dek)
    ciphertext_with_tag = aesgcm.encrypt(iv, plaintext.encode('utf-8'), None)
    
    # Combine: iv + ciphertext_with_tag
    combined = iv + ciphertext_with_tag
    
    return base64.b64encode(combined).decode('utf-8')


