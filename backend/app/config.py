from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Supabase
    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str  # Service role key (bypasses RLS)
    JWT_SECRET: str

    # Encryption
    ENCRYPTION_MASTER_KEY: str = ""  # Fernet key for API key encryption

    # Shared secret for cron/maintenance endpoints. Empty disables them.
    ADMIN_SECRET: str = ""

    # Environment
    ENVIRONMENT: str = "development"

    # CORS — comma-separated list of allowed origins
    ALLOWED_ORIGINS: str = "http://localhost:8080"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # Ignore extra env vars like RAILWAY_ENVIRONMENT


settings = Settings()
