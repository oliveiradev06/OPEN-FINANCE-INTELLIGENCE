"""Test setup: an isolated SQLite database seeded with a small synthetic portfolio.

Environment variables must be set before any ``app`` module is imported, because the
database engine is created from settings at import time.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

_TMP = Path(tempfile.mkdtemp(prefix="ofi-tests-"))
# CI also runs the suite against PostgreSQL by setting TEST_DATABASE_URL.
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL") or f"sqlite:///{(_TMP / 'test.db').as_posix()}"
os.environ["SEED_CUSTOMERS"] = "400"
os.environ["REFERENCE_DATE"] = "2026-09-24"
os.environ["AUTO_SEED"] = "true"
os.environ["ANTHROPIC_API_KEY"] = ""  # deterministic template mode

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client() -> TestClient:
    with TestClient(app) as test_client:  # lifespan seeds the database once
        yield test_client


@pytest.fixture
def features() -> dict:
    """A neutral customer that matches no rule; tests override what they need."""
    return {
        "balance_primary_avg_6m": 4000.0, "balance_primary_cv_6m": 0.3, "months_balance_stable": 3,
        "balance_primary_min_6m": 2500.0, "balance_primary_avg_3m": 4000.0, "balance_primary_avg_prev3m": 4000.0,
        "balance_primary_change": 0.0, "outflows_primary_avg_6m": 5000.0, "turnover_primary": 1.25,
        "balance_external_last": 1000.0, "liquid_total": 5000.0, "expensive_debt": 0.0, "expensive_debt_interest": 0.0,
        "expensive_debt_rate": 0.0, "debt_service_ratio": 0.1, "months_with_income": 12, "income_cv": 0.03,
        "income_avg_6m": 8000.0, "salary_at_primary": True, "investments_total": 0.0, "investments_primary": 0.0,
        "investments_external": 0.0, "external_investment_share": 0.0, "investments_primary_prev3m": 0.0,
        "investments_primary_change": 0.0, "investments_external_change": 0.0, "tenure_years": 5.0,
        "surplus_avg_6m": 1500.0, "surplus_ratio": 0.19, "expenses_avg_6m": 5500.0, "card_spend_total_3m": 2000.0,
        "card_external_share_3m": 0.2, "card_spend_external_3m": 400.0, "card_spend_primary_3m": 1600.0,
        "card_external_share_prev3m": 0.2, "has_primary_card": True, "loans_primary": 0.0, "loans_external": 0.0,
        "external_asset_share": 0.2, "months_salary_at_primary": 12, "institutions_count": 3,
        "salary_changed": False, "salary_institution": "aurora", "salary_institution_prev": "aurora",
        "salary_change_month": None,
    }
