import datetime as dt

import pytest

from app.services.opportunity_engine import OpportunityEngine
from app.services.opportunity_engine.rules import (
    CreditPortabilityRule,
    DebtOptimizationRule,
    IdleCashRule,
    InvestmentRule,
    RetentionRule,
    SpendingMigrationRule,
)

EMPTY_CTX = {"institutions": [], "loans": [], "cards": [], "investments": []}


def assert_explainable(candidate):
    assert 0 <= candidate.score <= 100
    assert candidate.evidence, "a score must never come without evidence"
    assert candidate.score == round(sum(f.points for f in candidate.factors))
    for factor in candidate.factors:
        assert 0 <= factor.points <= factor.max_points
    assert sum(f.max_points for f in candidate.factors) == 100


def test_neutral_customer_has_no_opportunities(features):
    now = dt.datetime(2026, 9, 24)
    assert OpportunityEngine().evaluate_customer("CUS-99999", features, EMPTY_CTX, now) == []


def test_idle_cash_detected_for_stable_high_balance(features):
    features.update(balance_primary_avg_6m=28000, balance_primary_min_6m=26500, balance_primary_cv_6m=0.03,
                    months_balance_stable=6, outflows_primary_avg_6m=7800, turnover_primary=0.28)
    candidate = IdleCashRule().evaluate(features, EMPTY_CTX)
    assert candidate is not None
    assert_explainable(candidate)
    assert candidate.estimated_value == pytest.approx(28000 - 0.5 * 7800)
    assert any("R$ 25 mil" in e.text for e in candidate.evidence)


def test_idle_cash_not_suggested_when_customer_has_expensive_debt(features):
    features.update(balance_primary_avg_6m=28000, balance_primary_min_6m=26500, balance_primary_cv_6m=0.03,
                    months_balance_stable=6, outflows_primary_avg_6m=7800, turnover_primary=0.28, expensive_debt=9000)
    assert IdleCashRule().evaluate(features, EMPTY_CTX) is None


def test_investment_opportunity_requires_external_concentration(features):
    ctx = {**EMPTY_CTX, "institutions": [{"institution_id": "btg", "investment_balance": 85000.0}]}
    features.update(investments_external=85000, investments_primary=8000, investments_total=93000,
                    external_investment_share=85000 / 93000)
    candidate = InvestmentRule().evaluate(features, ctx)
    assert candidate is not None
    assert_explainable(candidate)
    assert candidate.estimated_value == 85000
    assert "BTG" in candidate.evidence[0].text

    features.update(investments_primary=90000, external_investment_share=85000 / 175000)
    assert InvestmentRule().evaluate(features, ctx) is None


def test_debt_optimization_needs_available_cash(features):
    ctx = {**EMPTY_CTX, "loans": [{"institution_id": "inter", "loan_type": "credito_pessoal", "balance": 7800.0,
                                   "interest_rate": 5.4, "installment": 650.0, "remaining_months": 20}]}
    features.update(expensive_debt=7800, expensive_debt_interest=421.2, expensive_debt_rate=5.4, liquid_total=15000,
                    expenses_avg_6m=5400)
    candidate = DebtOptimizationRule().evaluate(features, ctx)
    assert candidate is not None
    assert_explainable(candidate)
    assert candidate.estimated_value == 7800
    assert any(e.kind == "caution" for e in candidate.evidence)

    features.update(liquid_total=4000)
    assert DebtOptimizationRule().evaluate(features, ctx) is None


def test_credit_portability_only_above_reference_rate(features):
    loan = {"institution_id": "bradesco", "loan_type": "consignado", "balance": 62000.0, "interest_rate": 2.05,
            "installment": 1837.0, "remaining_months": 58}
    candidate = CreditPortabilityRule().evaluate(features, {**EMPTY_CTX, "loans": [loan]})
    assert candidate is not None
    assert_explainable(candidate)
    assert any("nenhuma aprovação automática" in e.text for e in candidate.evidence)

    cheap = {**loan, "interest_rate": 1.5}
    assert CreditPortabilityRule().evaluate(features, {**EMPTY_CTX, "loans": [cheap]}) is None
    at_primary = {**loan, "institution_id": "aurora"}
    assert CreditPortabilityRule().evaluate(features, {**EMPTY_CTX, "loans": [at_primary]}) is None


def test_spending_migration_describes_the_shares(features):
    ctx = {**EMPTY_CTX, "institutions": [{"institution_id": "nubank", "card_spend_monthly": 2250.0}]}
    features.update(card_spend_total_3m=3120, card_external_share_3m=0.72, card_spend_external_3m=2250,
                    card_spend_primary_3m=870, card_external_share_prev3m=0.59)
    candidate = SpendingMigrationRule().evaluate(features, ctx)
    assert candidate is not None
    assert_explainable(candidate)
    shares = {m.key: m.value for m in candidate.metrics}
    assert shares["external_share"] == pytest.approx(0.72)
    assert shares["primary_share"] == pytest.approx(0.28)


def test_retention_flags_salary_portability(features):
    features.update(salary_changed=True, salary_institution="itau", salary_institution_prev="aurora",
                    salary_change_month="2026-07-01", balance_primary_avg_prev3m=19000, balance_primary_avg_3m=11000,
                    balance_primary_change=-0.42)
    candidate = RetentionRule().evaluate(features, EMPTY_CTX)
    assert candidate is not None
    assert_explainable(candidate)
    assert "Itaú" in candidate.evidence[0].text


def test_engine_opportunity_ids_are_stable(features):
    features.update(balance_primary_avg_6m=28000, balance_primary_min_6m=26500, balance_primary_cv_6m=0.03,
                    months_balance_stable=6, outflows_primary_avg_6m=7800, turnover_primary=0.28)
    found = OpportunityEngine().evaluate_customer("CUS-00042", features, EMPTY_CTX, dt.datetime(2026, 9, 24))
    assert [o["opportunity_id"] for o in found] == ["OPP-00042-IDL"]
    assert found[0]["priority"] in {"high", "medium", "low"}
