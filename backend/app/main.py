from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings

app = FastAPI(
    title="Household Harmony API",
    version="1.0.0",
    description="Backend API for Household Harmony budgeting app with Swedish tax intelligence and smart defaults",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Admin-Secret"],
    max_age=600,
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        if settings.ENVIRONMENT == "production":
            response.headers.setdefault(
                "Strict-Transport-Security",
                "max-age=31536000; includeSubDomains",
            )
        return response


app.add_middleware(SecurityHeadersMiddleware)

# Imported after app creation to avoid circular imports.
from app.routers import health, tax, smart_defaults, llm, api_keys, demo

app.include_router(health.router, tags=["health"])
app.include_router(tax.router, prefix="/api/tax", tags=["tax"])
app.include_router(smart_defaults.router, prefix="/api/defaults", tags=["smart_defaults"])
app.include_router(llm.router, prefix="/api/llm", tags=["llm"])
app.include_router(api_keys.router, prefix="/api/api-keys", tags=["api_keys"])
app.include_router(demo.router, prefix="/api/demo", tags=["demo"])


@app.get("/")
def root():
    """Root endpoint with API information."""
    return {
        "message": "Household Harmony API",
        "version": "1.0.0",
        "status": "active"
    }
