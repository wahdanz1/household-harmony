"""Demo mode router for creating ephemeral sandbox users."""

import logging
import secrets
import time
from datetime import datetime, timedelta
from typing import Dict

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.database import get_supabase_client
from app.services.demo_seeder import seed_demo_household

logger = logging.getLogger(__name__)

router = APIRouter()

# Rate limiting: Track IP addresses and request timestamps
_rate_limiter: Dict[str, list[float]] = {}
RATE_LIMIT_WINDOW = 3600  # 1 hour in seconds
RATE_LIMIT_MAX = 5  # 5 requests per hour per IP


class DemoUserResponse(BaseModel):
    """Response model for demo user creation."""
    email: str
    password: str
    user_id: str
    household_id: str


def check_rate_limit(ip: str) -> bool:
    """Check if IP has exceeded rate limit."""
    now = time.time()
    
    if ip not in _rate_limiter:
        _rate_limiter[ip] = []
    
    # Remove timestamps outside the window
    _rate_limiter[ip] = [
        t for t in _rate_limiter[ip]
        if now - t < RATE_LIMIT_WINDOW
    ]
    
    if len(_rate_limiter[ip]) >= RATE_LIMIT_MAX:
        logger.warning(f"Rate limit exceeded for IP {ip}")
        return True
    
    _rate_limiter[ip].append(now)
    return False


@router.post("/create", response_model=DemoUserResponse)
async def create_demo_user(request: Request):
    """
    Create ephemeral demo user with pre-populated Swedish household data.
    
    Rate limited to 5 requests per hour per IP address.
    """
    # Get client IP
    client_ip = request.client.host if request.client else "unknown"
    
    # Check rate limit
    if check_rate_limit(client_ip):
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Maximum 5 demo accounts per hour. Please try again later."
        )
    
    try:
        logger.info(f"Creating demo user from IP {client_ip}")
        
        # 1. Generate unique demo credentials
        timestamp = int(time.time())
        random_id = secrets.token_hex(4)
        email = f"demo_{timestamp}_{random_id}@household-harmony.demo"
        password = secrets.token_urlsafe(32)
        
        logger.info(f"Generated demo email: {email}")
        
        # 2. Create Supabase auth user
        supabase = get_supabase_client()
        
        auth_response = supabase.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"is_demo": True}
        })
        
        if not auth_response or not auth_response.user:
            raise Exception("Failed to create auth user")
        
        user_id = auth_response.user.id
        logger.info(f"Created auth user: {user_id}")
        
        # 3. Create encrypted vault for demo user (REAL encryption!)
        from app.services.encryption import create_demo_user_vault
        vault_keys = create_demo_user_vault(password)
        logger.info("Created encrypted vault with PBKDF2 + AES-256-GCM")
        
        # 4. Update profile with demo flag AND encrypted vault keys
        profile_result = supabase.table("profiles").upsert({
            "id": user_id,
            "email": email,
            "full_name": "Demo User",
            "is_demo": True,
            "encrypted_dek": vault_keys["encrypted_dek"],
            "dek_salt": vault_keys["dek_salt"],
            "dek_iv": vault_keys["dek_iv"],
            "encryption_version": 1,
        }).execute()
        
        if not profile_result:
            raise Exception("Failed to update profile")
        
        logger.info("Updated profile with demo flag and encrypted vault")
        
        # 4. Seed demo household with ENCRYPTED sample data
        # Pass the raw DEK so seeder can encrypt all sensitive fields
        household_id = await seed_demo_household(user_id, vault_keys["raw_dek"])
        logger.info(f"Seeded encrypted household: {household_id}")
        
        # 5. Return credentials for auto-login
        return DemoUserResponse(
            email=email,
            password=password,
            user_id=user_id,
            household_id=household_id
        )
        
    except Exception as e:
        logger.error(f"Failed to create demo user: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create demo user: {str(e)}"
        )


@router.delete("/cleanup")
async def cleanup_old_demo_users():
    """
    Delete demo users older than 24 hours.
    
    This endpoint should be called by a cron job or manually.
    Note: Admin/service key required (configured in deployment).
    """
    try:
        logger.info("Starting demo user cleanup")
        supabase = get_supabase_client()
        
        # Calculate cutoff time (24 hours ago)
        cutoff = datetime.now() - timedelta(hours=24)
        cutoff_iso = cutoff.isoformat()
        
        # Find old demo users
        result = supabase.table("profiles").select("id, email").eq(
            "is_demo", True
        ).lt("created_at", cutoff_iso).execute()
        
        if not result or not result.data:
            logger.info("No old demo users to clean up")
            return {"deleted": 0, "message": "No old demo users found"}
        
        deleted_count = 0
        
        for user in result.data:
            try:
                # Delete auth user (cascades to all data via RLS)
                supabase.auth.admin.delete_user(user["id"])
                deleted_count += 1
                logger.info(f"Deleted demo user: {user['email']}")
            except Exception as e:
                logger.error(f"Failed to delete user {user['id']}: {e}")
        
        logger.info(f"Cleanup complete: deleted {deleted_count} demo users")
        return {
            "deleted": deleted_count,
            "message": f"Successfully deleted {deleted_count} old demo users"
        }
        
    except Exception as e:
        logger.error(f"Cleanup failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Cleanup failed: {str(e)}"
        )


@router.get("/count")
async def get_demo_user_count():
    """
    Get current count of active demo users.
    
    Returns alert if count exceeds 50 (suggests cleanup is failing).
    """
    try:
        supabase = get_supabase_client()
        
        result = supabase.table("profiles").select(
            "id", count="exact"
        ).eq("is_demo", True).execute()
        
        count = result.count if result else 0
        alert = count > 50
        
        logger.info(f"Current demo user count: {count}")
        
        if alert:
            logger.warning(f"⚠️ ALERT: {count} demo users exist (cleanup may be failing)")
        
        return {
            "count": count,
            "alert": alert,
            "message": "Cleanup may be failing - manual intervention needed" if alert else "Normal"
        }
        
    except Exception as e:
        logger.error(f"Failed to get demo count: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get demo count: {str(e)}"
        )
