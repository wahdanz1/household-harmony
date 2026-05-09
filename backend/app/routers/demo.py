"""Demo mode router for creating ephemeral sandbox users."""

import logging
import secrets
import time
from datetime import datetime, timedelta
from typing import Dict

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel

from app.auth import require_admin_secret
from app.database import get_supabase_client
from app.services.demo_seeder import seed_demo_household

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory per-IP buckets — single-instance only.
_rate_limiter: Dict[str, list[float]] = {}
RATE_LIMIT_WINDOW = 3600
RATE_LIMIT_MAX = 5
_RATE_LIMITER_MAX_KEYS = 10_000


class DemoUserResponse(BaseModel):
    email: str
    password: str
    user_id: str
    household_id: str


def _client_ip(request: Request) -> str:
    """Real client IP from `X-Forwarded-For` (leftmost), else direct peer."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    return request.client.host if request.client else "unknown"


def check_rate_limit(ip: str) -> bool:
    """Return True if the IP is over the limit."""
    now = time.time()

    if ip not in _rate_limiter and len(_rate_limiter) >= _RATE_LIMITER_MAX_KEYS:
        oldest = min(_rate_limiter.items(), key=lambda kv: max(kv[1]) if kv[1] else 0)
        _rate_limiter.pop(oldest[0], None)

    timestamps = [t for t in _rate_limiter.get(ip, []) if now - t < RATE_LIMIT_WINDOW]

    if len(timestamps) >= RATE_LIMIT_MAX:
        _rate_limiter[ip] = timestamps
        logger.warning("Demo rate limit exceeded for IP %s", ip)
        return True

    timestamps.append(now)
    _rate_limiter[ip] = timestamps
    return False


@router.post("/create", response_model=DemoUserResponse)
async def create_demo_user(request: Request):
    """Create an ephemeral demo user with pre-populated Swedish household data.

    Rate limited to 5 requests per hour per client IP.
    """
    client_ip = _client_ip(request)

    if check_rate_limit(client_ip):
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Maximum 5 demo accounts per hour. Please try again later.",
        )

    try:
        timestamp = int(time.time())
        random_id = secrets.token_hex(4)
        email = f"demo_{timestamp}_{random_id}@household-harmony.demo"
        password = secrets.token_urlsafe(32)

        supabase = get_supabase_client()

        auth_response = supabase.auth.admin.create_user(
            {
                "email": email,
                "password": password,
                "email_confirm": True,
                "user_metadata": {"is_demo": True},
            }
        )

        if not auth_response or not auth_response.user:
            raise RuntimeError("Failed to create auth user")

        user_id = auth_response.user.id

        from app.services.encryption import create_demo_user_vault

        vault_keys = create_demo_user_vault(password)

        profile_result = supabase.table("profiles").upsert(
            {
                "id": user_id,
                "email": email,
                "full_name": "Demo User",
                "is_demo": True,
                "encrypted_dek": vault_keys["encrypted_dek"],
                "dek_salt": vault_keys["dek_salt"],
                "dek_iv": vault_keys["dek_iv"],
                "encryption_version": 1,
            }
        ).execute()

        if not profile_result:
            raise RuntimeError("Failed to update profile")

        household_id = await seed_demo_household(user_id, vault_keys["raw_dek"])
        logger.info("Demo user provisioned: %s (household %s)", user_id, household_id)

        return DemoUserResponse(
            email=email,
            password=password,
            user_id=user_id,
            household_id=household_id,
        )

    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to create demo user")
        raise HTTPException(status_code=500, detail="Failed to create demo user")


@router.delete("/cleanup")
async def cleanup_old_demo_users(
    x_admin_secret: str | None = Header(default=None, alias="X-Admin-Secret"),
):
    """Delete demo users older than 24 hours. Admin-gated."""
    require_admin_secret(x_admin_secret)

    try:
        supabase = get_supabase_client()
        cutoff = (datetime.now() - timedelta(hours=24)).isoformat()

        result = (
            supabase.table("profiles")
            .select("id, email")
            .eq("is_demo", True)
            .lt("created_at", cutoff)
            .execute()
        )

        if not result or not result.data:
            return {"deleted": 0, "message": "No old demo users found"}

        deleted_count = 0
        failed_count = 0

        for user in result.data:
            try:
                supabase.auth.admin.delete_user(user["id"])
                deleted_count += 1
            except Exception:
                failed_count += 1
                logger.exception("Failed to delete demo user %s", user["id"])

        logger.info(
            "Demo cleanup: deleted=%d failed=%d", deleted_count, failed_count
        )
        return {
            "deleted": deleted_count,
            "failed": failed_count,
            "message": f"Deleted {deleted_count} demo users ({failed_count} failed)",
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception("Demo cleanup failed")
        raise HTTPException(status_code=500, detail="Cleanup failed")


@router.get("/count")
async def get_demo_user_count(
    x_admin_secret: str | None = Header(default=None, alias="X-Admin-Secret"),
):
    """Demo user count. Admin-gated."""
    require_admin_secret(x_admin_secret)

    try:
        supabase = get_supabase_client()
        result = (
            supabase.table("profiles")
            .select("id", count="exact")
            .eq("is_demo", True)
            .execute()
        )
        count = result.count if result else 0
        alert = count > 50

        if alert:
            logger.warning("Demo user count high: %d (cleanup may be failing)", count)

        return {
            "count": count,
            "alert": alert,
            "message": "Cleanup may be failing - manual intervention needed"
            if alert
            else "Normal",
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to get demo count")
        raise HTTPException(status_code=500, detail="Failed to get demo count")
