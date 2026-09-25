from __future__ import annotations

import datetime as dt
from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
DEFAULT_SQLITE_PATH = BACKEND_DIR / "data" / "ofi.db"


class Settings(BaseSettings):
    """Runtime configuration. Every field can be overridden by an env var of the same name."""

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Open Finance Intelligence API"
    environment: str = "development"

    # PostgreSQL in Docker (postgresql+psycopg://...). Falls back to a local SQLite file
    # so the project runs on machines without Docker/PostgreSQL.
    database_url: str = f"sqlite:///{DEFAULT_SQLITE_PATH.as_posix()}"
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])

    # Synthetic dataset
    seed_customers: int = 5000
    seed_random_state: int = 42
    seed_months: int = 12
    reference_date: dt.date | None = None  # None -> today
    auto_seed: bool = True  # generate the dataset on startup when the database is empty

    primary_institution_id: str = "aurora"

    # Generative AI — only verbalizes facts already computed by the engines.
    # Without a key the platform uses a deterministic template writer (same facts, no LLM).
    anthropic_api_key: str | None = None
    ai_model: str = "claude-opus-5"
    ai_effort: str = "low"  # grounded summarization of precomputed facts is a simple task
    ai_timeout_seconds: float = 45.0

    # Simulated analyst identity (real deployments would take this from SSO/OIDC).
    default_analyst_id: str = "ana.ribeiro"
    default_analyst_name: str = "Ana Ribeiro"
    default_analyst_role: str = "analista"

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @property
    def ai_enabled(self) -> bool:
        return bool(self.anthropic_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
