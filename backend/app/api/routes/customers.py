"""Customer search, Customer 360, institution drill-down and AI endpoints."""

from __future__ import annotations

import datetime as dt
import math
from collections import defaultdict
from dataclasses import dataclass
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import exists, func, or_, select
from sqlalchemy.orm import Session

from app.api.routes.portfolio import opportunity_types_by_customer
from app.core.database import get_db
from app.core.formatting import normalize_text
from app.core.security import Analyst, audit, require
from app.data import reference as ref
from app.data.generator import add_months
from app.models import (
    BehaviorSignal,
    Consent,
    Customer,
    CustomerInstitution,
    CustomerMetrics,
    CustomerMonthlyMetric,
    InsightCustomer,
    Opportunity,
    Segment,
)
from app.schemas import (
    AISummaryOut,
    AskRequest,
    AskResponse,
    Customer360,
    CustomerListItem,
    CustomerSearchHit,
    InstitutionDrilldown,
    Page,
)
from app.schemas.customer import CustomerTabCounts
from app.services import ai_insights
from app.services.customer_360 import build_customer_360, build_institution_drilldown

router = APIRouter(prefix="/api/customers", tags=["customers"])

PURPOSE = "Análise de relacionamento e oportunidades (finalidade do consentimento)"
SORTABLE = {
    "name": Customer.name,
    "health_score": CustomerMetrics.health_score,
    "opportunity_score": CustomerMetrics.opportunity_score,
    "total_assets": CustomerMetrics.total_assets,
    "total_debt": CustomerMetrics.total_debt,
    "monthly_income": CustomerMetrics.monthly_income,
    "institutions_count": CustomerMetrics.institutions_count,
    "opportunity_value": CustomerMetrics.opportunity_value,
}


@dataclass
class CustomerFilters:
    search: str | None = None
    min_score: int | None = None
    max_score: int | None = None
    opportunity_type: list[str] | None = None
    institution_id: str | None = None
    min_assets: float | None = None
    max_assets: float | None = None
    min_income: float | None = None
    max_income: float | None = None
    debt_level: list[str] | None = None
    min_institutions: int | None = None
    max_institutions: int | None = None
    health_band: list[str] | None = None
    segment_id: int | None = None
    segment: str | None = None
    signal: str | None = None
    insight: str | None = None
    anomaly: bool | None = None
    has_opportunities: bool | None = None
    has_signals: bool | None = None
    new_connections: bool | None = None
    customer_id: list[str] | None = None


def customer_filters(
    search: str | None = Query(None, description="Nome ou ID do cliente"),
    min_score: int | None = Query(None, ge=0, le=100),
    max_score: int | None = Query(None, ge=0, le=100),
    opportunity_type: list[str] | None = Query(None),
    institution_id: str | None = None,
    min_assets: float | None = None,
    max_assets: float | None = None,
    min_income: float | None = None,
    max_income: float | None = None,
    debt_level: list[str] | None = Query(None),
    min_institutions: int | None = None,
    max_institutions: int | None = None,
    health_band: list[str] | None = Query(None),
    segment_id: int | None = None,
    segment: str | None = Query(None, description="Varejo | Alta Renda | Private"),
    signal: str | None = None,
    insight: str | None = None,
    anomaly: bool | None = None,
    has_opportunities: bool | None = Query(None, description="Com ao menos uma oportunidade"),
    has_signals: bool | None = Query(None, description="Com mudança de comportamento no último trimestre"),
    new_connections: bool | None = Query(None, description="Primeiro consentimento Open Finance no mês de referência"),
    customer_id: list[str] | None = Query(None, description="Lista de IDs (ex.: favoritos do analista)"),
) -> CustomerFilters:
    return CustomerFilters(**locals())


def reference_month_bounds(db: Session) -> tuple[dt.datetime, dt.datetime] | None:
    month = db.scalar(select(func.max(CustomerMonthlyMetric.month)))
    if month is None:
        return None
    return dt.datetime.combine(month, dt.time()), dt.datetime.combine(add_months(month, 1), dt.time())


def filter_conditions(db: Session, f: CustomerFilters, skip: tuple[str, ...] = ()) -> list:
    cm = CustomerMetrics
    conditions = []
    if f.search:
        conditions.append(cm.search_text.contains(normalize_text(f.search.strip())))
    if f.min_score is not None:
        conditions.append(cm.opportunity_score >= f.min_score)
    if f.max_score is not None:
        conditions.append(cm.opportunity_score <= f.max_score)
    if f.opportunity_type:
        conditions.append(exists().where(Opportunity.customer_id == cm.customer_id, Opportunity.type.in_(f.opportunity_type)))
    if f.institution_id:
        conditions.append(exists().where(CustomerInstitution.customer_id == cm.customer_id,
                                         CustomerInstitution.institution_id == f.institution_id))
    for column, low, high in ((cm.total_assets, f.min_assets, f.max_assets), (cm.monthly_income, f.min_income, f.max_income),
                              (cm.institutions_count, f.min_institutions, f.max_institutions)):
        if low is not None:
            conditions.append(column >= low)
        if high is not None:
            conditions.append(column <= high)
    if f.debt_level:
        conditions.append(cm.debt_level.in_(f.debt_level))
    if f.health_band:
        conditions.append(cm.health_band.in_(f.health_band))
    if f.segment_id is not None:
        conditions.append(cm.segment_id == f.segment_id)
    if f.segment:
        conditions.append(cm.customer_id.in_(select(Customer.customer_id).where(Customer.segment == f.segment)))
    if f.signal:
        conditions.append(exists().where(BehaviorSignal.customer_id == cm.customer_id, BehaviorSignal.signal_type == f.signal))
    if f.insight:
        conditions.append(exists().where(InsightCustomer.customer_id == cm.customer_id, InsightCustomer.insight_id == f.insight))
    if f.anomaly is not None:
        conditions.append(cm.is_anomaly == f.anomaly)
    if f.customer_id:
        conditions.append(cm.customer_id.in_(f.customer_id))
    if f.has_opportunities is not None and "has_opportunities" not in skip:
        conditions.append(cm.opportunities_count > 0 if f.has_opportunities else cm.opportunities_count == 0)
    if f.has_signals is not None and "has_signals" not in skip:
        conditions.append(cm.signals_count > 0 if f.has_signals else cm.signals_count == 0)
    if f.new_connections and "new_connections" not in skip:
        conditions.append(cm.customer_id.in_(new_connections_subquery(db)))
    return conditions


def new_connections_subquery(db: Session):
    """Customers whose first Open Finance consent was granted in the reference month."""
    bounds = reference_month_bounds(db)
    first = func.min(Consent.granted_at)
    stmt = select(Consent.customer_id).group_by(Consent.customer_id)
    return stmt.having(first >= bounds[0], first < bounds[1]) if bounds else stmt.having(first.is_(None))


def consent_status_by_customer(db: Session, customer_ids: list[str]) -> dict[str, str]:
    """Open Finance status shown in lists: expiring wins over active (it needs action)."""
    statuses: dict[str, set[str]] = defaultdict(set)
    if customer_ids:
        for cid, status in db.execute(select(Consent.customer_id, Consent.status).where(Consent.customer_id.in_(customer_ids))):
            statuses[cid].add(status)
    result = {}
    for cid in customer_ids:
        found = statuses.get(cid, set())
        result[cid] = next((s for s in ("expiring", "active", "revoked") if s in found), "none")
    return result


@router.get("", response_model=Page[CustomerListItem])
def list_customers(
    filters: CustomerFilters = Depends(customer_filters),
    sort: Literal["name", "health_score", "opportunity_score", "total_assets", "total_debt", "monthly_income",
                  "institutions_count", "opportunity_value"] = "opportunity_score",
    order: Literal["asc", "desc"] = "desc",
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    _: Analyst = Depends(require("customers:read")),
) -> dict:
    cm = CustomerMetrics
    stmt = select(cm, Customer.name, Customer.segment, Customer.age_range, Customer.occupation_category, Customer.state).join(
        Customer, Customer.customer_id == cm.customer_id
    )
    conditions = filter_conditions(db, filters)
    if conditions:
        stmt = stmt.where(*conditions)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    column = SORTABLE[sort]
    stmt = stmt.order_by(column.desc() if order == "desc" else column.asc(), cm.customer_id)
    rows = db.execute(stmt.offset((page - 1) * page_size).limit(page_size)).all()

    ids = [r[0].customer_id for r in rows]
    links: dict[str, list[str]] = defaultdict(list)
    if ids:
        for cid, inst in db.execute(select(CustomerInstitution.customer_id, CustomerInstitution.institution_id)
                                    .where(CustomerInstitution.customer_id.in_(ids))):
            links[cid].append(inst)
    segments = {s.segment_id: s.name for s in db.scalars(select(Segment))}
    consent = consent_status_by_customer(db, ids)
    types = opportunity_types_by_customer(db, ids)

    items = [{
        "customer_id": m.customer_id, "name": name, "segment": seg, "age_range": age, "occupation_category": occ,
        "state": state, "monthly_income": m.monthly_income, "health_score": m.health_score, "health_band": m.health_band,
        "opportunity_score": m.opportunity_score, "top_opportunity_type": m.top_opportunity_type,
        "opportunities_count": m.opportunities_count, "opportunity_value": m.opportunity_value,
        "opportunity_types": types[m.customer_id],
        "total_assets": m.total_assets, "total_debt": m.total_debt, "debt_level": m.debt_level,
        "institutions_count": m.institutions_count,
        "institutions": sorted(links[m.customer_id], key=lambda i: (i != ref.PRIMARY_INSTITUTION_ID, i)),
        "signals_count": m.signals_count, "is_anomaly": m.is_anomaly, "segment_id": m.segment_id,
        "segment_name": segments.get(m.segment_id), "consent_status": consent[m.customer_id],
    } for m, name, seg, age, occ, state in rows]
    return {"items": items, "total": total, "page": page, "page_size": page_size,
            "pages": max(1, math.ceil(total / page_size))}


@router.get("/tab-counts", response_model=CustomerTabCounts)
def tab_counts(filters: CustomerFilters = Depends(customer_filters), db: Session = Depends(get_db),
               _: Analyst = Depends(require("customers:read"))) -> dict:
    """How many customers each list tab would show, keeping the other filters applied."""
    cm = CustomerMetrics
    base = filter_conditions(db, filters, skip=("has_opportunities", "has_signals", "new_connections"))

    def count(*extra) -> int:
        return db.scalar(select(func.count()).select_from(cm).where(*base, *extra)) or 0

    return {
        "all": count(),
        "with_opportunities": count(cm.opportunities_count > 0),
        "with_signals": count(cm.signals_count > 0),
        "new_connections": count(cm.customer_id.in_(new_connections_subquery(db))),
    }


@router.get("/search", response_model=list[CustomerSearchHit])
def search_customers(q: str = Query(..., min_length=2), limit: int = Query(8, ge=1, le=20),
                     db: Session = Depends(get_db), _: Analyst = Depends(require("customers:read"))) -> list[dict]:
    term = normalize_text(q.strip())
    rows = db.execute(
        select(CustomerMetrics, Customer.name, Customer.segment)
        .join(Customer, Customer.customer_id == CustomerMetrics.customer_id)
        .where(or_(CustomerMetrics.search_text.contains(term), Customer.customer_id == q.strip().upper()))
        .order_by(CustomerMetrics.opportunity_score.desc())
        .limit(limit)
    ).all()
    return [{"customer_id": m.customer_id, "name": name, "segment": seg, "opportunity_score": m.opportunity_score,
             "top_opportunity_type": m.top_opportunity_type} for m, name, seg in rows]


def _load_360(db: Session, customer_id: str) -> dict:
    payload = build_customer_360(db, customer_id)
    if payload is None:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    return payload


@router.get("/{customer_id}", response_model=Customer360)
def customer_360(customer_id: str, db: Session = Depends(get_db),
                 analyst: Analyst = Depends(require("customers:read"))) -> dict:
    payload = _load_360(db, customer_id)
    audit(db, analyst, "customer.view_360", "customer", customer_id, PURPOSE)
    return payload


@router.get("/{customer_id}/institutions/{institution_id}", response_model=InstitutionDrilldown)
def institution_drilldown(customer_id: str, institution_id: str, db: Session = Depends(get_db),
                          analyst: Analyst = Depends(require("customers:read"))) -> dict:
    payload = build_institution_drilldown(db, customer_id, institution_id)
    if payload is None:
        raise HTTPException(status_code=404, detail="Relacionamento não encontrado.")
    audit(db, analyst, "customer.view_institution", "customer", customer_id, PURPOSE, {"institution_id": institution_id})
    return payload


@router.get("/{customer_id}/summary", response_model=AISummaryOut)
def ai_summary(customer_id: str, db: Session = Depends(get_db), analyst: Analyst = Depends(require("ai:use"))) -> dict:
    payload = _load_360(db, customer_id)
    metrics = db.get(CustomerMetrics, customer_id)
    result = ai_insights.generate_summary(payload, cache_key=(customer_id, metrics.updated_at))
    audit(db, analyst, "ai.summary", "customer", customer_id, PURPOSE, {"source": result["source"]})
    return result


@router.post("/{customer_id}/ask", response_model=AskResponse)
def ask_intelligence(customer_id: str, body: AskRequest, db: Session = Depends(get_db),
                     analyst: Analyst = Depends(require("ai:use"))) -> dict:
    payload = _load_360(db, customer_id)
    result = ai_insights.answer_question(body.question.strip(), payload)
    audit(db, analyst, "ai.ask", "customer", customer_id, PURPOSE,
          {"question": body.question[:200], "source": result["source"]})
    return result
