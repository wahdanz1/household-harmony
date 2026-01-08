from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

app = FastAPI(
    title="Household Harmony API",
    version="1.0.0",
    description="Backend API for Household Harmony budgeting app with Swedish tax intelligence and smart defaults"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import routers after app creation to avoid circular imports
from app.routers import health, tax, smart_defaults, llm, api_keys

# Include routers
app.include_router(health.router, tags=["health"])
app.include_router(tax.router, prefix="/api/tax", tags=["tax"])
app.include_router(smart_defaults.router, prefix="/api/defaults", tags=["smart_defaults"])
app.include_router(llm.router, prefix="/api/llm", tags=["llm"])
app.include_router(api_keys.router, prefix="/api/api-keys", tags=["api_keys"])


@app.get("/")
def root():
    """Root endpoint with API information."""
    return {
        "message": "Household Harmony API",
        "version": "1.0.0",
        "status": "active"
    }
