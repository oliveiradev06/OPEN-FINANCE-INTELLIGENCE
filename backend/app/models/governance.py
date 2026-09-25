"""Governance / LGPD: simulated consents, access audit trail and engine execution log."""

from __future__ import annotations

import datetime as dt

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, JSONType


class Consent(Base):
    __tablename__ = "consents"

    consent_id: Mapped[str] = mapped_column(String(20), primary_key=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.customer_id"), index=True)
    institution_id: Mapped[str] = mapped_column(ForeignKey("institutions.institution_id"))
    status: Mapped[str] = mapped_column(String(16))  # active | expiring | revoked
    scopes: Mapped[list] = mapped_column(JSONType)
    purpose: Mapped[str] = mapped_column(String(160))
    granted_at: Mapped[dt.datetime] = mapped_column(DateTime)
    expires_at: Mapped[dt.datetime] = mapped_column(DateTime)
    last_sync_at: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    timestamp: Mapped[dt.datetime] = mapped_column(DateTime, index=True)
    actor: Mapped[str] = mapped_column(String(60))
    role: Mapped[str] = mapped_column(String(24))
    action: Mapped[str] = mapped_column(String(48))
    resource_type: Mapped[str] = mapped_column(String(32))
    resource_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    purpose: Mapped[str] = mapped_column(String(120))
    details: Mapped[dict | None] = mapped_column(JSONType, nullable=True)


class EngineRun(Base):
    __tablename__ = "engine_runs"

    run_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    started_at: Mapped[dt.datetime] = mapped_column(DateTime)
    finished_at: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(16))
    trigger: Mapped[str] = mapped_column(String(16))  # seed | manual
    engine_version: Mapped[str] = mapped_column(String(16))
    customers_processed: Mapped[int] = mapped_column(Integer, default=0)
    opportunities_created: Mapped[int] = mapped_column(Integer, default=0)
    signals_created: Mapped[int] = mapped_column(Integer, default=0)
    stats: Mapped[dict] = mapped_column(JSONType)
