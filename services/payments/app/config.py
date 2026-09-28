import socket
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    service_name: str = "payments"
    database_url: str = "sqlite+aiosqlite:///./payments.db"
    redis_url: str = "redis://localhost:6379/0"
    events_stream: str = "orderflow:events"
    consumer_group: str = "payments"
    consumer_name: str = socket.gethostname()
    # Artificial latency so the saga is visible in the UI. Set to 0 in tests.
    processing_delay_ms: int = 1500
    # Charges above this amount are declined, like a card limit.
    card_limit: float = 5000
    enable_messaging: bool = True
    cors_origins: list[str] = ["*"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
