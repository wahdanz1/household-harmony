"""JWT verification for Supabase auth tokens."""

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel

from app.config import settings
from app.database import get_supabase_client


class AuthenticatedUser(BaseModel):
    id: str
    email: str | None = None


_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> AuthenticatedUser:
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    return AuthenticatedUser(id=user_id, email=payload.get("email"))


CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]


def verify_household_member(user_id: str, household_id: str) -> None:
    """Raise 404 unless `user_id` is a member of `household_id`.

    404 (not 403) so callers cannot enumerate household ids.
    """
    supabase = get_supabase_client()
    result = (
        supabase.table("household_members")
        .select("user_id")
        .eq("user_id", user_id)
        .eq("household_id", household_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")


def require_admin_secret(secret_header: str | None) -> None:
    """Gate an endpoint behind `ADMIN_SECRET`. Fails closed when unset."""
    import hmac

    expected = settings.ADMIN_SECRET
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin endpoints disabled",
        )
    if not secret_header or not hmac.compare_digest(secret_header, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin authorization required",
        )
