from __future__ import annotations

import datetime as dt

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, JSONType, Money


class Opportunity(Base):
    """An opportunity detected by the rule engine. Never stored without its evidence."""

    __tablename__ = "opportunities"

    opportunity_id: Mapped[str] = mapped_column(String(16), primary_key=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.customer_id"), index=True)
    type: Mapped[str] = mapped_column(String(32), index=True)
    score: Mapped[int] = mapped_column(Integer, index=True)
    priority: Mapped[str] = mapped_column(String(8))
    estimated_value: Mapped[float] = mapped_column(Money)
    title: Mapped[str] = mapped_column(String(120))
    summary: Mapped[str] = mapped_column(String(400))
    evidence: Mapped[list] = mapped_column(JSONType)
    score_breakdown: Mapped[list] = mapped_column(JSONType)
    metrics: Mapped[list] = mapped_column(JSONType)
    context: Mapped[dict] = mapped_column(JSONType)  # data for the type-specific visualization
    recommended_action: Mapped[str] = mapped_column(String(400))
    rule_id: Mapped[str] = mapped_column(String(40))
    engine_version: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(16), default="new")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime)

    __table_args__ = (Index("ix_opportunities_type_score", "type", "score"),)
