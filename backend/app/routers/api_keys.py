"""API keys router for managing user LLM API keys."""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.auth import CurrentUser, verify_household_member
from app.database import get_supabase_client
from app.services.encryption import encrypt_api_key

logger = logging.getLogger(__name__)

router = APIRouter()

ALLOWED_PROVIDERS = ("groq", "gemini")


class SaveApiKeyRequest(BaseModel):
    api_key: str = Field(min_length=10, max_length=512)
    provider: str
    household_id: str


class SaveApiKeyResponse(BaseModel):
    success: bool
    provider: str


@router.post("", response_model=SaveApiKeyResponse)
async def save_api_key(body: SaveApiKeyRequest, user: CurrentUser):
    """Save an encrypted API key for the authenticated user.

    The API key is encrypted with the backend master key before storage.
    """
    if body.provider not in ALLOWED_PROVIDERS:
        raise HTTPException(status_code=400, detail="Invalid provider")

    verify_household_member(user.id, body.household_id)

    try:
        encrypted_key = encrypt_api_key(body.api_key)
        supabase = get_supabase_client()
        supabase.table("user_api_keys").upsert(
            {
                "user_id": user.id,
                "household_id": body.household_id,
                "provider": body.provider,
                "encrypted_key": encrypted_key,
                "is_encrypted": True,
                "updated_at": "now()",
            },
            on_conflict="user_id,provider",
        ).execute()
        logger.info("API key saved for user %s, provider %s", user.id, body.provider)
        return SaveApiKeyResponse(success=True, provider=body.provider)
    except ValueError as e:
        logger.error("Encryption error saving API key: %s", e)
        raise HTTPException(status_code=500, detail="Encryption misconfigured")
    except Exception:
        logger.exception("Failed to save API key for user %s", user.id)
        raise HTTPException(status_code=500, detail="Failed to save API key")


@router.delete("/{provider}")
async def delete_api_key(provider: str, user: CurrentUser):
    """Delete the authenticated user's API key for a specific provider."""
    if provider not in ALLOWED_PROVIDERS:
        raise HTTPException(status_code=400, detail="Invalid provider")

    try:
        supabase = get_supabase_client()
        supabase.table("user_api_keys").delete().eq("user_id", user.id).eq(
            "provider", provider
        ).execute()
        logger.info("API key deleted for user %s, provider %s", user.id, provider)
        return {"success": True}
    except Exception:
        logger.exception("Failed to delete API key for user %s", user.id)
        raise HTTPException(status_code=500, detail="Failed to delete API key")


@router.get("/status")
async def get_api_key_status(user: CurrentUser):
    """Check which providers the authenticated user has configured."""
    try:
        supabase = get_supabase_client()
        result = (
            supabase.table("user_api_keys")
            .select("provider, updated_at")
            .eq("user_id", user.id)
            .execute()
        )
        providers = {row["provider"]: row["updated_at"] for row in (result.data or [])}
        return {
            "has_groq": "groq" in providers,
            "has_gemini": "gemini" in providers,
            "providers": providers,
        }
    except Exception:
        logger.exception("Failed to fetch API key status for user %s", user.id)
        raise HTTPException(status_code=500, detail="Failed to check API key status")
