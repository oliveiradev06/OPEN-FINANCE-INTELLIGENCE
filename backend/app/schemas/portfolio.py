from __future__ import annotations

import datetime as dt
from typing import Any

from app.schemas.common import Evidence, InstitutionRef, Schema, ScoreFactor


class KpiTrendPoint(Schema):
    month: dt.date
    total_assets: float
    investments: float
    debt: float
    card_spend: float


class EngineRunRef(Schema):
    run_id: str
    finished_at: dt.datetime | None
    duration_ms: int | None
    trigger: str
    engine_version: str


class ConnectionPoint(Schema):
    """Open Finance adoption at the end of each month (cumulative)."""

    month: dt.date
    customers_connected: int
    consents: int
    new_customers: int


class ScoreBand(Schema):
    key: str
    label: str
    min: int
    max: int
    count: int
    share: float


class PortfolioSummary(Schema):
    customers: int
    customers_with_opportunities: int
    customers_connected: int
    new_connections_last_month: int
    customers_with_signals: int
    customers_high_severity: int
    total_assets: float
    total_investments: float
    total_debt: float
    opportunities: int
    open_opportunities: int
    opportunity_value: float
    priority_customers: int
    institutions_connected: int
    avg_health_score: float
    signals: int
    active_consents: int
    consents_last_month: int
    external_asset_share: float
    reference_month: dt.date
    last_run: EngineRunRef | None
    trend: list[KpiTrendPoint]
    connections_trend: list[ConnectionPoint]
    score_bands: list[ScoreBand]


class PriorityCustomer(Schema):
    customer_id: str
    name: str
    segment: str
    health_score: int
    opportunity_id: str
    opportunity_score: int
    opportunity_type: str
    opportunity_label: str
    estimated_value: float
    summary: str
    reasons: list[Evidence]
    score_breakdown: list[ScoreFactor]
    institutions_count: int
    institutions: list[InstitutionRef]
    opportunity_types: list[str]
    last_update: dt.datetime


class WalletShareRow(Schema):
    product: str
    label: str
    primary: float
    external: float
    primary_share: float
    top_external: list[dict[str, Any]]


class WalletShareTrendPoint(Schema):
    month: dt.date
    balances: float
    investments: float
    card_spend: float


class WalletShare(Schema):
    products: list[WalletShareRow]
    trend: list[WalletShareTrendPoint]


class RecentSignal(Schema):
    signal_id: str
    customer_id: str
    customer_name: str
    signal_type: str
    type_label: str
    severity: str
    title: str
    description: str
    detected_at: dt.date


class ActivityItem(Schema):
    """One entry of the dashboard feed, always derived from data of the last engine run."""

    kind: str  # connections | opportunities | priority | alerts | consents
    tone: str  # green | amber | blue | red | violet
    title: str
    detail: str
    timestamp: dt.datetime
    href: str


class InsightOut(Schema):
    insight_id: str
    rank: int
    category: str
    severity: str
    title: str
    description: str
    headline_value: float
    headline_format: str
    affected_customers: int
    filters: dict[str, Any]
    chart: dict[str, Any] | None
    generated_at: dt.datetime
