from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "CampusFix"
    DATABASE_URL: str = "sqlite:///./campusfix.db"
    
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 7 days
    
    FRONTEND_URLS: str = "http://localhost:5173"

    # Storage configuration ("local" for dev/tests, "db" for Render Free PostgreSQL, "disk" for Render Disk, "s3" for S3-compatible)
    STORAGE_BACKEND: str = "local"
    PERSISTENT_DISK_PATH: Optional[str] = None
    S3_BUCKET_NAME: Optional[str] = None
    S3_REGION: str = "auto"
    S3_ENDPOINT_URL: Optional[str] = None
    S3_ACCESS_KEY_ID: Optional[str] = None
    S3_SECRET_ACCESS_KEY: Optional[str] = None
    S3_PREFIX: str = "complaints"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        if not isinstance(value, str):
            return value
        url = value.strip()
        if url.startswith("postgres://"):
            return "postgresql+pg8000://" + url[len("postgres://"):]
        if url.startswith("postgresql://"):
            return "postgresql+pg8000://" + url[len("postgresql://"):]
        return url

    @property
    def cors_origins(self) -> List[str]:
        return [url.strip() for url in self.FRONTEND_URLS.split(",") if url.strip()]

settings = Settings()
