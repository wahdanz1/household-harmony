from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Supabase
    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str  # Service role key (bypasses RLS)
    JWT_SECRET: str
    
    # Encryption
    ENCRYPTION_MASTER_KEY: str = ""  # Fernet key for API key encryption
    
    # Environment
    ENVIRONMENT: str = "development"
    
    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:8080"
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # Ignore extra env vars like RAILWAY_ENVIRONMENT


settings = Settings()
