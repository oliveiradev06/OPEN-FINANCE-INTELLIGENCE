from __future__ import annotations

import datetime as dt
from typing import Any, Literal

from pydantic import Field

from app.schemas.common import Evidence, MetricValue, Schema, ScoreFactor

OpportunityStatus = Literal["new", "in_review", "contacted", "converted", "dismissed"]


class OpportunityOut(Schema):
    opportunity_id: str
    customer_id: str
    type: str
    type_label: str
    title: str
    score: int
    priority: str
    estimated_value: float
    summary: str
    evidence: list[Evidence]
    score_breakdown: list[ScoreFactor]
    metrics: list[MetricValue]
    context: dict[str, Any]
    recommended_action: str
    rule_id: str
    engine_version: str
    status: str
    status_label: str
    created_at: dt.datetime
    updated_at: dt.datetime


class OpportunityListItem(Schema):
    opportunity_id: str
    customer_id: str
    customer_name: str
    segment: str
    institutions_count: int
    type: str
    type_label: str
    title: str
    score: int
    priority: str
    estimated_value: float
    summary: str
    top_evidence: list[str]
    status: str
    status_label: str
    created_at: dt.datetime


class CustomerSnippet(Schema):
    customer_id: str
    name: str
    segment: str
    age_range: str
    occupation_category: str
    monthly_income: float
    total_assets: float
    total_debt: float
    health_score: int
    health_band: str
    institutions_count: int
    tenure_years: float


class OpportunityBrief(Schema):
    opportunity_id: str
    type: str
    type_label: str
    score: int
    estimated_value: float
    status: str


class OpportunityEvent(Schema):
    timestamp: dt.datetime
    kind: str  # detected | status_change
    actor: str
    role: str | None
    from_status: str | None
    to_status: str | None
    note: str | None


class OpportunityDetail(OpportunityOut):
    customer: CustomerSnippet
    series: list[dict[str, Any]]
    related: list[OpportunityBrief]
    history: list[OpportunityEvent]
    explanation: str
    guardrail: str


class OpportunityStatusUpdate(Schema):
    status: OpportunityStatus
    note: str | None = Field(default=None, max_length=300)


class OpportunityTypeSummary(Schema):
    type: str
    label: str
    title: str
    count: int
    value: float
    avg_score: float
    high_priority: int
    share: float


class OpportunitiesSummary(Schema):
    total: int
    total_value: float
    high_priority: int
    by_type: list[OpportunityTypeSummary]
    by_status: dict[str, int]
