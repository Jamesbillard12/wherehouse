from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://wherehouse:wherehouse@localhost:5432/wherehouse"
    cors_origins: str = "http://localhost:5173"
    upload_dir: str = "./uploads"
    image_storage_backend: str = "local"
    s3_bucket: str | None = None
    s3_region: str | None = None
    s3_endpoint_url: str | None = None
    s3_access_key_id: str | None = None
    s3_secret_access_key: str | None = None
    public_base_url: str = "http://localhost:8000"
    user_session_ttl_hours: int = 24
    pairing_session_ttl_minutes: int = 10
    backup_provider: str = "local"
    backup_staging_dir: str = "./backup-staging"
    backup_local_dir: str = "./backups"
    backup_local_config_file: str = "./.data/local-backup-destination.json"
    backup_retention_count: int = 7
    dropbox_app_key: str | None = None
    dropbox_app_secret: str | None = None
    dropbox_refresh_token: str | None = None
    dropbox_credential_file: str = "./.data/dropbox-backup-credentials.json"
    dropbox_redirect_uri: str = "http://localhost:8000/api/v1/backups/providers/dropbox/callback"
    dropbox_backup_folder: str = "/WhereHouse/Backups"
    instance_id: str | None = None
    wherehouse_version: str | None = None
    appliance_image_version: str | None = None
    appliance_build_date: str | None = None
    appliance_hostname: str = "wherehouse.local"
    appliance_data_dir: str = "/data"
    storage_warning_free_bytes: int = 2 * 1024 * 1024 * 1024
    storage_critical_free_bytes: int = 512 * 1024 * 1024

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
