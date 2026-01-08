"""Encryption service for backend API key management using Fernet."""

import logging
from cryptography.fernet import Fernet, InvalidToken
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
