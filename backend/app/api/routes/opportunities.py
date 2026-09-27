"""Opportunity list, detail and analyst workflow (status changes are audited)."""

from __future__ import annotations

import datetime as dt
import math
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.routes.portfolio import opportunity_distribution
from app.core.database import get_db
from app.core.formatting import normalize_text
from app.core.security import Analyst, audit, require
from app.data import reference as ref
from app.models import AuditLog, Customer, CustomerMetrics, CustomerMonthlyMetric, Opportunity
from app.schemas import OpportunitiesSummary, OpportunityDetail, OpportunityListItem, OpportunityStatusUpdate, Page
from app.services.ai_insights import explain_opportunity
from app.services.customer_360 import timeline_rows
from app.services.serializers import opportunity_out

router = APIRouter(prefix="/api/opportunities", tags=["opportunities"])

GUARDRAIL = ("Esta análise apoia a decisão do analista. Nenhuma aprovação de crédito, alteração de limite, "
             "negação de serviço ou bloqueio é realizada automaticamente pela plataforma.")
SORTABLE = {"score": Opportunity.score, "estimated_value": Opportunity.estimated_value, "created_at": Opportunity.created_at}


@router.get("", response_model=Page[OpportunityListItem])
def list_opportunities(
    type: list[str] | None = Query(None),  # noqa: A002 - public query parameter name
    priority: list[str] | None = Query(None),
    status: list[str] | None = Query(None),
    min_score: int | None = Query(None, ge=0, le=100),
    search: str | None = None,
    customer_id: str | None = None,
    sort: Literal["score", "estimated_value", "created_at"] = "score",
    order: Literal["asc", "desc"] = "desc",
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    _: Analyst = Depends(require("customers:read")),
) -> dict:
    stmt = (
        select(Opportunity, Customer.name, Customer.segment, CustomerMetrics.institutions_count)
        .join(Customer, Customer.customer_id == Opportunity.customer_id)
        .join(CustomerMetrics, CustomerMetrics.customer_id == Opportunity.customer_id)
    )
    if type:
        stmt = stmt.where(Opportunity.type.in_(type))
    if priority:
        stmt = stmt.where(Opportunity.priority.in_(priority))
    if status:
        stmt = stmt.where(Opportunity.status.in_(status))
    if min_score is not None:
        stmt = stmt.where(Opportunity.score >= min_score)
    if customer_id:
        stmt = stmt.where(Opportunity.customer_id == customer_id)
    if search:
        stmt = stmt.where(CustomerMetrics.search_text.contains(normalize_text(search.strip())))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    column = SORTABLE[sort]
    stmt = stmt.order_by(column.desc() if order == "desc" else column.asc(), Opportunity.opportunity_id)
    rows = db.execute(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    items = [{
        "opportunity_id": o.opportunity_id, "customer_id": o.customer_id, "customer_name": name, "segment": segment,
        "institutions_count": n_inst, "type": o.type, "type_label": ref.OPPORTUNITY_TYPES[o.type]["label"],
        "title": o.title, "score": o.score, "priority": o.priority, "estimated_value": o.estimated_value,
        "summary": o.summary, "top_evidence": [e["text"] for e in o.evidence if e["kind"] == "support"][:3],
        "status": o.status, "status_label": ref.OPPORTUNITY_STATUSES.get(o.status, o.status), "created_at": o.created_at,
    } for o, name, segment, n_inst in rows]
    return {"items": items, "total": total, "page": page, "page_size": page_size,
            "pages": max(1, math.ceil(total / page_size))}


@router.get("/summary", response_model=OpportunitiesSummary)
def opportunities_summary(db: Session = Depends(get_db), _: Analyst = Depends(require("portfolio:read"))) -> dict:
    by_type = opportunity_distribution(db)
    by_status = dict(db.execute(select(Opportunity.status, func.count()).group_by(Opportunity.status)).all())
    return {
        "total": sum(t["count"] for t in by_type),
        "total_value": round(sum(t["value"] for t in by_type), 2),
        "high_priority": sum(t["high_priority"] for t in by_type),
        "by_type": by_type,
        "by_status": {k: int(by_status.get(k, 0)) for k in ref.OPPORTUNITY_STATUSES},
    }


def _detail(db: Session, opp: Opportunity) -> dict:
    customer = db.get(Customer, opp.customer_id)
    metrics = db.get(CustomerMetrics, opp.customer_id)
    monthly = db.scalars(
        select(CustomerMonthlyMetric).where(CustomerMonthlyMetric.customer_id == opp.customer_id)
        .order_by(CustomerMonthlyMetric.month)
    ).all()
    related = db.scalars(
        select(Opportunity).where(Opportunity.customer_id == opp.customer_id,
                                  Opportunity.opportunity_id != opp.opportunity_id)
        .order_by(Opportunity.score.desc())
    ).all()
    payload = opportunity_out(opp)
    changes = db.scalars(
        select(AuditLog).where(AuditLog.resource_type == "opportunity", AuditLog.resource_id == opp.opportunity_id,
                               AuditLog.action == "opportunity.status_change")
        .order_by(AuditLog.timestamp.desc(), AuditLog.id.desc())
    ).all()
    history = [{"timestamp": log.timestamp, "kind": "status_change", "actor": log.actor, "role": log.role,
                "from_status": (log.details or {}).get("from"), "to_status": (log.details or {}).get("to"),
                "note": (log.details or {}).get("note")} for log in changes]
    history.append({"timestamp": opp.created_at, "kind": "detected", "actor": f"Motor v{opp.engine_version}", "role": None,
                    "from_status": None, "to_status": "new", "note": f"Regra {opp.rule_id}"})
    return {
        **payload,
        "history": history,
        "customer": {
            "customer_id": customer.customer_id, "name": customer.name, "segment": customer.segment,
            "age_range": customer.age_range, "occupation_category": customer.occupation_category,
            "monthly_income": metrics.monthly_income, "total_assets": metrics.total_assets,
            "total_debt": metrics.total_debt, "health_score": metrics.health_score, "health_band": metrics.health_band,
            "institutions_count": metrics.institutions_count, "tenure_years": metrics.features.get("tenure_years", 0.0),
        },
        "series": timeline_rows(monthly),
        "related": [{"opportunity_id": r.opportunity_id, "type": r.type, "type_label": ref.OPPORTUNITY_TYPES[r.type]["label"],
                     "score": r.score, "estimated_value": r.estimated_value, "status": r.status} for r in related],
        "explanation": explain_opportunity(payload),
        "guardrail": GUARDRAIL,
    }


@router.get("/{opportunity_id}", response_model=OpportunityDetail)
def opportunity_detail(opportunity_id: str, db: Session = Depends(get_db),
                       analyst: Analyst = Depends(require("customers:read"))) -> dict:
    opp = db.get(Opportunity, opportunity_id)
    if opp is None:
        raise HTTPException(status_code=404, detail="Oportunidade não encontrada.")
    audit(db, analyst, "opportunity.view", "opportunity", opportunity_id,
          "Análise de oportunidade detectada pelo motor", {"customer_id": opp.customer_id})
    return _detail(db, opp)


@router.patch("/{opportunity_id}", response_model=OpportunityDetail)
def update_status(opportunity_id: str, body: OpportunityStatusUpdate, db: Session = Depends(get_db),
                  analyst: Analyst = Depends(require("opportunities:update"))) -> dict:
    opp = db.get(Opportunity, opportunity_id)
    if opp is None:
        raise HTTPException(status_code=404, detail="Oportunidade não encontrada.")
    previous = opp.status
    opp.status = body.status
    opp.updated_at = dt.datetime.now().replace(microsecond=0)
    db.commit()
    audit(db, analyst, "opportunity.status_change", "opportunity", opportunity_id,
          "Workflow do analista", {"from": previous, "to": body.status, "note": body.note})
    db.refresh(opp)
    return _detail(db, opp)
