"""Curated/analytics layer produced by the pipeline (ETL -> features -> engines)."""

from __future__ import annotations

import datetime as dt

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, JSONType, Money


class BalanceSnapshot(Base):
    """Month-end positions per customer x institution, as shared through Open Finance."""

    __tablename__ = "balance_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.customer_id"))
    institution_id: Mapped[str] = mapped_column(ForeignKey("institutions.institution_id"))
    month: Mapped[dt.date] = mapped_column(Date)
    account_balance: Mapped[float] = mapped_column(Money)
    investment_balance: Mapped[float] = mapped_column(Money)
    loan_balance: Mapped[float] = mapped_column(Money)
    card_bill: Mapped[float] = mapped_column(Money)

    __table_args__ = (Index("ix_snapshots_customer_month", "customer_id", "month"),)


class CustomerMonthlyMetric(Base):
    """One row per customer x month — cash flow (from transactions) and positions (from snapshots)."""

    __tablename__ = "customer_monthly_metrics"

    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.customer_id"), primary_key=True)
    month: Mapped[dt.date] = mapped_column(Date, primary_key=True)
    income: Mapped[float] = mapped_column(Money)
    expenses: Mapped[float] = mapped_column(Money)
    debt_payments: Mapped[float] = mapped_column(Money)
    investment_net: Mapped[float] = mapped_column(Money)
    available_cash: Mapped[float] = mapped_column(Money)
    outflows_primary: Mapped[float] = mapped_column(Money)
    card_spend_primary: Mapped[float] = mapped_column(Money)
    card_spend_external: Mapped[float] = mapped_column(Money)
    balance_primary: Mapped[float] = mapped_column(Money)
    balance_external: Mapped[float] = mapped_column(Money)
    investments_primary: Mapped[float] = mapped_column(Money)
    investments_external: Mapped[float] = mapped_column(Money)
    debt_total: Mapped[float] = mapped_column(Money)
    net_worth: Mapped[float] = mapped_column(Money)
    salary_institution_id: Mapped[str | None] = mapped_column(String(32), nullable=True)


class CustomerInstitution(Base):
    """Relationship between a customer and one institution (edges of the ecosystem graph)."""

    __tablename__ = "customer_institutions"

    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.customer_id"), primary_key=True)
    institution_id: Mapped[str] = mapped_column(
        ForeignKey("institutions.institution_id"), primary_key=True, index=True
    )
    products: Mapped[list] = mapped_column(JSONType)
    receives_salary: Mapped[bool] = mapped_column(Boolean, default=False)
    account_balance: Mapped[float] = mapped_column(Money)
    investment_balance: Mapped[float] = mapped_column(Money)
    debt_balance: Mapped[float] = mapped_column(Money)
    card_spend_monthly: Mapped[float] = mapped_column(Money)
    card_limit: Mapped[float] = mapped_column(Money)
    monthly_inflow: Mapped[float] = mapped_column(Money)
    monthly_outflow: Mapped[float] = mapped_column(Money)
    share_of_assets: Mapped[float] = mapped_column(Float)


class CustomerMetrics(Base):
    """Denormalized, query-friendly profile: features + scores. Powers lists, filters and KPIs."""

    __tablename__ = "customer_metrics"

    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.customer_id"), primary_key=True)
    search_text: Mapped[str] = mapped_column(String(160), index=True)  # lowercase, accent-free name + id
    monthly_income: Mapped[float] = mapped_column(Money)
    monthly_expenses: Mapped[float] = mapped_column(Money)
    total_balance: Mapped[float] = mapped_column(Money)
    total_investments: Mapped[float] = mapped_column(Money)
    total_assets: Mapped[float] = mapped_column(Money, index=True)
    total_debt: Mapped[float] = mapped_column(Money)
    expensive_debt: Mapped[float] = mapped_column(Money)
    net_worth: Mapped[float] = mapped_column(Money)
    institutions_count: Mapped[int] = mapped_column(Integer)
    external_asset_share: Mapped[float] = mapped_column(Float)
    card_external_share: Mapped[float] = mapped_column(Float)
    debt_service_ratio: Mapped[float] = mapped_column(Float)
    debt_level: Mapped[str] = mapped_column(String(12))
    health_score: Mapped[int] = mapped_column(Integer, index=True)
    health_band: Mapped[str] = mapped_column(String(16))
    health_components: Mapped[list] = mapped_column(JSONType)
    opportunity_score: Mapped[int] = mapped_column(Integer, index=True)
    top_opportunity_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    opportunities_count: Mapped[int] = mapped_column(Integer)
    opportunity_value: Mapped[float] = mapped_column(Money)
    signals_count: Mapped[int] = mapped_column(Integer)
    segment_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    anomaly_score: Mapped[float] = mapped_column(Float)
    is_anomaly: Mapped[bool] = mapped_column(Boolean, index=True)
    anomaly_reasons: Mapped[list] = mapped_column(JSONType)
    features: Mapped[dict] = mapped_column(JSONType)
    last_sync_at: Mapped[dt.datetime] = mapped_column(DateTime)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime)


class BehaviorSignal(Base):
    __tablename__ = "behavior_signals"

    signal_id: Mapped[str] = mapped_column(String(16), primary_key=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.customer_id"), index=True)
    signal_type: Mapped[str] = mapped_column(String(32), index=True)
    severity: Mapped[str] = mapped_column(String(8))
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(String(300))
    metric_before: Mapped[float | None] = mapped_column(Float, nullable=True)
    metric_after: Mapped[float | None] = mapped_column(Float, nullable=True)
    change_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    detected_at: Mapped[dt.date] = mapped_column(Date)
    details: Mapped[dict] = mapped_column(JSONType)


class Segment(Base):
    """Behavioral segment produced by KMeans clustering."""

    __tablename__ = "segments"

    segment_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(60))
    description: Mapped[str] = mapped_column(String(300))
    size: Mapped[int] = mapped_column(Integer)
    profile: Mapped[dict] = mapped_column(JSONType)


class PortfolioInsight(Base):
    __tablename__ = "portfolio_insights"

    insight_id: Mapped[str] = mapped_column(String(40), primary_key=True)
    rank: Mapped[int] = mapped_column(Integer)
    category: Mapped[str] = mapped_column(String(32))
    severity: Mapped[str] = mapped_column(String(16))
    title: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(String(400))
    headline_value: Mapped[float] = mapped_column(Float)
    headline_format: Mapped[str] = mapped_column(String(16))
    affected_customers: Mapped[int] = mapped_column(Integer)
    filters: Mapped[dict] = mapped_column(JSONType)
    chart: Mapped[dict | None] = mapped_column(JSONType, nullable=True)
    generated_at: Mapped[dt.datetime] = mapped_column(DateTime)


class InsightCustomer(Base):
    """Customers behind each insight, so "ver clientes" lists exactly who produced the number."""

    __tablename__ = "portfolio_insight_customers"

    insight_id: Mapped[str] = mapped_column(ForeignKey("portfolio_insights.insight_id"), primary_key=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.customer_id"), primary_key=True)
