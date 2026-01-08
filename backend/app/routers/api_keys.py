"""API keys router for managing user LLM API keys."""

import logging
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.database import get_supabase_client
from app.services.encryption import encrypt_api_key

logger = logging.getLogger(__name__)

router = APIRouter()


class SaveApiKeyRequest(BaseModel):
    """Request body for saving an API key."""
    api_key: str
    provider: str  # 'groq' or 'gemini'


class SaveApiKeyResponse(BaseModel):
    """Response after saving an API key."""
    success: bool
    provider: str


@router.post("", response_model=SaveApiKeyResponse)
async def save_api_key(
    request: Request,
    body: SaveApiKeyRequest,
):
    """
    Save an encrypted API key for the user.
    
    The API key is encrypted with the backend master key before storage.
    This endpoint requires authentication via the Authorization header.
    """
    logger.info(f"save_api_key called for provider: {body.provider}")
    
    # Extract user info from Authorization header
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization required")
    
    # Get user_id and household_id from query params
    user_id = request.query_params.get("user_id")
    household_id = request.query_params.get("household_id")
    
    if not user_id or not household_id:
        raise HTTPException(
            status_code=400,
            detail="user_id and household_id query params required"
        )
    
    # Validate provider
    if body.provider not in ("groq", "gemini"):
        raise HTTPException(
            status_code=400,
            detail="Provider must be 'groq' or 'gemini'"
        )
    
    # Validate API key
    if not body.api_key or len(body.api_key) < 10:
        raise HTTPException(
            status_code=400,
            detail="Invalid API key"
        )
    
    try:
        # Encrypt the API key with backend master key
        encrypted_key = encrypt_api_key(body.api_key)
        logger.info(f"Encrypted API key (length: {len(encrypted_key)})")
        
        # Store in database
        supabase = get_supabase_client()
        
        result = supabase.table("user_api_keys").upsert({
            "user_id": user_id,
            "household_id": household_id,
            "provider": body.provider,
            "encrypted_key": encrypted_key,
            "is_encrypted": True,  # Now encrypted with backend master key
            "updated_at": "now()",
        }, on_conflict="user_id,provider").execute()
        
        logger.info(f"API key saved successfully for user {user_id}, provider {body.provider}")
        
        return SaveApiKeyResponse(success=True, provider=body.provider)
        
    except ValueError as e:
        # Encryption configuration error
        logger.error(f"Encryption error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to save API key: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to save API key")


@router.delete("/{provider}")
async def delete_api_key(
    request: Request,
    provider: str,
):
    """Delete a user's API key for a specific provider."""
    logger.info(f"delete_api_key called for provider: {provider}")
    
    # Extract auth
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization required")
    
    user_id = request.query_params.get("user_id")
    
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id query param required")
    
    if provider not in ("groq", "gemini"):
        raise HTTPException(status_code=400, detail="Invalid provider")
    
    try:
        supabase = get_supabase_client()
        
        supabase.table("user_api_keys").delete().eq(
            "user_id", user_id
        ).eq("provider", provider).execute()
        
        logger.info(f"API key deleted for user {user_id}, provider {provider}")
        
        return {"success": True}
        
    except Exception as e:
        logger.error(f"Failed to delete API key: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete API key")


@router.get("/status")
async def get_api_key_status(request: Request):
    """Check if user has API keys configured (without exposing the keys)."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization required")
    
    user_id = request.query_params.get("user_id")
    
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id query param required")
    
    try:
        supabase = get_supabase_client()
        
        result = supabase.table("user_api_keys").select(
            "provider, updated_at"
        ).eq("user_id", user_id).execute()
        
        providers = {row["provider"]: row["updated_at"] for row in (result.data or [])}
        
        return {
            "has_groq": "groq" in providers,
            "has_gemini": "gemini" in providers,
            "providers": providers,
        }
        
    except Exception as e:
        logger.error(f"Failed to get API key status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to check API key status")
