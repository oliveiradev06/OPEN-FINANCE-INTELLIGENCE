from __future__ import annotations

import datetime as dt
from typing import Any

from pydantic import Field

from app.schemas.common import InstitutionRef, Schema
from app.schemas.opportunity import OpportunityOut


class CustomerListItem(Schema):
    customer_id: str
    name: str
    segment: str
    age_range: str
    occupation_category: str
    state: str
    monthly_income: float
    health_score: int
    health_band: str
    opportunity_score: int
    top_opportunity_type: str | None
    opportunities_count: int
    opportunity_value: float
    opportunity_types: list[str]
    total_assets: float
    total_debt: float
    debt_level: str
    institutions_count: int
    institutions: list[str]
    signals_count: int
    is_anomaly: bool
    segment_id: int | None
    segment_name: str | None
    consent_status: str  # active | expiring | revoked | none


class CustomerTabCounts(Schema):
    all: int
    with_opportunities: int
    with_signals: int
    new_connections: int


class CustomerSearchHit(Schema):
    customer_id: str
    name: str
    segment: str
    opportunity_score: int
    top_opportunity_type: str | None


class HealthComponent(Schema):
    key: str
    label: str
    weight: float
    metric: str
    score: float
    points: float
    display: str
    explanation: str


class HealthOut(Schema):
    score: int
    band: str
    band_label: str
    components: list[HealthComponent]


class CustomerProfile(Schema):
    customer_id: str
    name: str
    age_range: str
    occupation_category: str
    segment: str
    state: str
    relationship_since: dt.date
    tenure_years: float
    declared_income: float
    primary_bank: InstitutionRef


class CustomerKpis(Schema):
    monthly_income: float
    monthly_expenses: float
    total_balance: float
    total_investments: float
    total_assets: float
    total_debt: float
    expensive_debt: float
    net_worth: float
    institutions_count: int
    external_asset_share: float
    card_external_share: float
    debt_service_ratio: float
    debt_level: str
    opportunity_score: int
    opportunities_count: int
    opportunity_value: float
    signals_count: int


class EcosystemNode(Schema):
    institution: InstitutionRef
    products: list[str]
    receives_salary: bool
    account_balance: float
    investment_balance: float
    debt_balance: float
    card_spend_monthly: float
    card_limit: float
    monthly_inflow: float
    monthly_outflow: float
    share_of_assets: float
    consent_status: str | None


class CashFlowBreakdown(Schema):
    income: float
    expenses: float
    debt_payments: float
    investments: float
    available: float


class CashFlowOut(Schema):
    month: dt.date
    last_month: CashFlowBreakdown
    average_6m: CashFlowBreakdown


class TimelinePoint(Schema):
    month: dt.date
    income: float
    expenses: float
    debt_payments: float
    investment_net: float
    available_cash: float
    balance_primary: float
    balance_external: float
    investments_primary: float
    investments_external: float
    debt_total: float
    net_worth: float
    card_spend_primary: float
    card_spend_external: float
    salary_institution_id: str | None


class SignalOut(Schema):
    signal_id: str
    customer_id: str
    signal_type: str
    type_label: str
    severity: str
    title: str
    description: str
    metric_before: float | None
    metric_after: float | None
    change_pct: float | None
    detected_at: dt.date
    details: dict[str, Any]


class RelationshipRow(Schema):
    category: str
    label: str
    primary_value: float
    external_value: float
    primary_share: float | None
    held_at: list[dict[str, Any]]


class ConsentItem(Schema):
    consent_id: str
    institution: InstitutionRef
    status: str
    scopes: list[str]
    purpose: str
    granted_at: dt.datetime
    expires_at: dt.datetime
    last_sync_at: dt.datetime | None


class ConsentSummary(Schema):
    active: int
    expiring: int
    revoked: int
    items: list[ConsentItem]


class SegmentRef(Schema):
    segment_id: int
    name: str
    description: str


class AnomalyOut(Schema):
    is_anomaly: bool
    score: float
    reasons: list[str]


class AssetSlice(Schema):
    key: str
    label: str
    value: float
    share: float


class ProductAccount(Schema):
    account_id: str
    institution: InstitutionRef
    account_type: str
    label: str
    balance: float
    average_balance: float
    opened_at: dt.date


class ProductCard(Schema):
    card_id: str
    institution: InstitutionRef
    brand: str
    tier: str
    credit_limit: float
    monthly_bill: float
    utilization: float


class ProductInvestment(Schema):
    investment_id: str
    institution: InstitutionRef
    investment_type: str
    label: str
    product_name: str
    balance: float
    risk_category: str
    liquidity: str


class ProductLoan(Schema):
    loan_id: str
    institution: InstitutionRef
    loan_type: str
    label: str
    balance: float
    interest_rate: float
    installment: float
    remaining_months: int | None
    reference_rate: float | None
    expensive: bool


class CustomerProducts(Schema):
    """Every product the customer holds, across all connected institutions."""

    accounts: list[ProductAccount]
    cards: list[ProductCard]
    investments: list[ProductInvestment]
    loans: list[ProductLoan]


class Customer360(Schema):
    customer: CustomerProfile
    metrics: CustomerKpis
    health: HealthOut
    segment: SegmentRef | None
    anomaly: AnomalyOut
    consent: ConsentSummary
    ecosystem: list[EcosystemNode]
    cash_flow: CashFlowOut
    timeline: list[TimelinePoint]
    opportunities: list[OpportunityOut]
    signals: list[SignalOut]
    relationship_map: list[RelationshipRow]
    asset_breakdown: list[AssetSlice]
    products: CustomerProducts
    last_sync_at: dt.datetime
    reference_month: dt.date


class TransactionOut(Schema):
    transaction_id: int
    date: dt.date
    description: str
    category: str
    category_label: str
    transaction_type: str
    amount: float


class InstitutionDrilldown(Schema):
    institution: InstitutionRef
    relationship: EcosystemNode
    accounts: list[dict[str, Any]]
    cards: list[dict[str, Any]]
    investments: list[dict[str, Any]]
    loans: list[dict[str, Any]]
    transactions: list[TransactionOut]
    spending_by_category: list[dict[str, Any]]
    monthly: list[dict[str, Any]]
    avg_monthly_spend: float
    consent: ConsentItem | None


class AISummaryOut(Schema):
    summary: str
    source: str  # llm | template
    model: str | None
    generated_at: dt.datetime
    facts_used: list[str]
    disclaimer: str
    notice: str | None = None


class AskRequest(Schema):
    question: str = Field(min_length=3, max_length=500)


class AskResponse(Schema):
    question: str
    answer: str
    source: str
    model: str | None
    facts_used: list[str]
    notice: str | None = None
