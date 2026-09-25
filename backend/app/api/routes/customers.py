"""Customer search, Customer 360, institution drill-down and AI endpoints."""

from __future__ import annotations

import math
from collections import defaultdict
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import exists, func, or_, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.formatting import normalize_text
from app.core.security import Analyst, audit, require
from app.data import reference as ref
from app.models import (
    BehaviorSignal,
    Customer,
    CustomerInstitution,
    CustomerMetrics,
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


@router.get("", response_model=Page[CustomerListItem])
def list_customers(
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
    sort: Literal["name", "health_score", "opportunity_score", "total_assets", "total_debt", "monthly_income",
                  "institutions_count", "opportunity_value"] = "opportunity_score",
    order: Literal["asc", "desc"] = "desc",
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    _: Analyst = Depends(require("customers:read")),
) -> dict:
    cm = CustomerMetrics
    stmt = select(cm, Customer.name, Customer.segment, Customer.age_range, Customer.occupation_category).join(
        Customer, Customer.customer_id == cm.customer_id
    )
    conditions = []
    if search:
        term = normalize_text(search.strip())
        conditions.append(cm.search_text.contains(term))
    if min_score is not None:
        conditions.append(cm.opportunity_score >= min_score)
    if max_score is not None:
        conditions.append(cm.opportunity_score <= max_score)
    if opportunity_type:
        conditions.append(exists().where(Opportunity.customer_id == cm.customer_id, Opportunity.type.in_(opportunity_type)))
    if institution_id:
        conditions.append(exists().where(CustomerInstitution.customer_id == cm.customer_id,
                                         CustomerInstitution.institution_id == institution_id))
    for column, low, high in ((cm.total_assets, min_assets, max_assets), (cm.monthly_income, min_income, max_income),
                              (cm.institutions_count, min_institutions, max_institutions)):
        if low is not None:
            conditions.append(column >= low)
        if high is not None:
            conditions.append(column <= high)
    if debt_level:
        conditions.append(cm.debt_level.in_(debt_level))
    if health_band:
        conditions.append(cm.health_band.in_(health_band))
    if segment_id is not None:
        conditions.append(cm.segment_id == segment_id)
    if segment:
        conditions.append(Customer.segment == segment)
    if signal:
        conditions.append(exists().where(BehaviorSignal.customer_id == cm.customer_id, BehaviorSignal.signal_type == signal))
    if insight:
        conditions.append(exists().where(InsightCustomer.customer_id == cm.customer_id, InsightCustomer.insight_id == insight))
    if anomaly is not None:
        conditions.append(cm.is_anomaly == anomaly)
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

    items = [{
        "customer_id": m.customer_id, "name": name, "segment": seg, "age_range": age, "occupation_category": occ,
        "monthly_income": m.monthly_income, "health_score": m.health_score, "health_band": m.health_band,
        "opportunity_score": m.opportunity_score, "top_opportunity_type": m.top_opportunity_type,
        "opportunities_count": m.opportunities_count, "opportunity_value": m.opportunity_value,
        "total_assets": m.total_assets, "total_debt": m.total_debt, "debt_level": m.debt_level,
        "institutions_count": m.institutions_count,
        "institutions": sorted(links[m.customer_id], key=lambda i: (i != ref.PRIMARY_INSTITUTION_ID, i)),
        "signals_count": m.signals_count, "is_anomaly": m.is_anomaly, "segment_id": m.segment_id,
        "segment_name": segments.get(m.segment_id),
    } for m, name, seg, age, occ in rows]
    return {"items": items, "total": total, "page": page, "page_size": page_size,
            "pages": max(1, math.ceil(total / page_size))}


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
