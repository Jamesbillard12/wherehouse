from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://wherehouse:wherehouse@localhost:5432/wherehouse"
    cors_origins: str = "http://localhost:5173"
    upload_dir: str = "./uploads"
    public_base_url: str = "http://localhost:8000"
    user_session_ttl_hours: int = 24
    pairing_session_ttl_minutes: int = 10

    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_prefix="",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
