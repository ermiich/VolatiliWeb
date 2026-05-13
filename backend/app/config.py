from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    @property
    def celery_result_backend(self) -> str:
        return (
            f"db+postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )
    postgres_user: str = "volatiliweb"
    postgres_password: str = "changeme_in_production"
    postgres_db: str = "volatiliweb_db"
    postgres_host: str = "db"
    postgres_port: int = 5432
    redis_url: str = "redis://redis:6379/0"
    celery_broker_url: str = "redis://redis:6379/0"
    evidence_path: str = "/evidence"
    symbols_path: str = "/symbols"
    secret_key: str = "dev_secret_key"
    allowed_origins: str = "http://localhost:3000"
    max_upload_size_mb: int = 32768
    upload_chunk_size_mb: int = 100

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def sync_database_url(self) -> str:
        return (
            f"postgresql+psycopg2://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def allowed_origins_list(self) -> list[str]:
        parts = [item.strip() for item in self.allowed_origins.split(",") if item.strip()]
        return parts or ["http://localhost:3000"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
