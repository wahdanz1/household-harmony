from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Supabase
    SUPABASE_URL: str
    SUPABASE_KEY: str
    JWT_SECRET: str
    
    # Environment
    ENVIRONMENT: str = "development"
    
    # CORS
    ALLOWED_ORIGINS: List[str] = ["http://localhost:8080", "http://localhost:5173"]
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
