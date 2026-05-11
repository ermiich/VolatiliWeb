from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    postgres_user: str = "volatiliweb"
    postgres_password: str = "changeme_in_production"
    postgres_db: str = "volatiliweb_db"
    postgres_host: str = "db"
    postgres_port: int = 5432
    redis_url: str = "redis://redis:6379/0"
    celery_broker_url: str = "redis://redis:6379/0"
    celery_result_backend: str = (
        "db+postgresql://volatiliweb:changeme_in_production@db:5432/volatiliweb_db"
    )
    evidence_path: str = "/evidence"
    symbols_path: str = "/symbols"

    @property
    def sync_database_url(self) -> str:
        return (
            f"postgresql+psycopg2://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
