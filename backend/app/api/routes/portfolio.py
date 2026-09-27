"""Portfolio Intelligence (dashboard) endpoints."""

from __future__ import annotations

import datetime as dt
from bisect import bisect_left
from collections import defaultdict

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.api.routes.meta import latest_run, run_ref
from app.core.database import get_db
from app.core.formatting import brl_compact, month_label, number
from app.core.security import require
from app.data import reference as ref
from app.data.generator import add_months
from app.models import (
    BehaviorSignal,
    Consent,
    Customer,
    CustomerInstitution,
    CustomerMetrics,
    CustomerMonthlyMetric,
    Opportunity,
)
from app.schemas import ActivityItem, PortfolioSummary, PriorityCustomer, RecentSignal, WalletShare
from app.schemas.opportunity import OpportunityTypeSummary
from app.services.behavior_analysis import SIGNAL_TYPES
from app.services.opportunity_engine.base import MIN_SCORE
from app.services.serializers import institution_ref

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"], dependencies=[Depends(require("portfolio:read"))])

PRIMARY = ref.PRIMARY_INSTITUTION_ID
SEVERITY_RANK = case((BehaviorSignal.severity == "high", 0), (BehaviorSignal.severity == "medium", 1), else_=2)
SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2}
OPEN_STATUSES = ("new", "in_review", "contacted")

# 10-point bands over the customers that have an opportunity. 80 and 60 are also the
# priority thresholds of the engine, so "alto + muito alto" = high priority.
SCORE_BANDS = [
    ("very_high", "Muito alto", 90, 100),
    ("high", "Alto", 80, 89),
    ("medium", "Médio", 70, 79),
    ("low", "Baixo", 60, 69),
    ("very_low", "Muito baixo", MIN_SCORE, 59),
]

# How each behaviour signal reads inside "N alertas de ..." on the activity feed.
SIGNAL_PHRASES = {
    "salary_change": "mudança na entrada de salário",
    "investment_outflow": "saída de investimentos",
    "balance_drop": "queda de saldo no banco",
    "competitor_card_increase": "aumento de uso de cartão concorrente",
    "spending_increase": "aumento de gastos",
    "income_drop": "queda de renda",
    "debt_increase": "aumento de endividamento",
}


def _month_bounds(month: dt.date) -> tuple[dt.datetime, dt.datetime]:
    return dt.datetime.combine(month, dt.time()), dt.datetime.combine(add_months(month, 1), dt.time())


def connection_trend(db: Session, months: list[dt.date]) -> list[dict]:
    """Customers sharing Open Finance data and consents granted, cumulative at each month end."""
    if not months:
        return []
    firsts = sorted(v for (v,) in db.execute(select(func.min(Consent.granted_at)).group_by(Consent.customer_id)) if v)
    granted = sorted(v for (v,) in db.execute(select(Consent.granted_at)) if v)
    previous = bisect_left(firsts, _month_bounds(months[0])[0])
    rows = []
    for month in months:
        end = _month_bounds(month)[1]
        connected = bisect_left(firsts, end)
        rows.append({"month": month, "customers_connected": connected, "consents": bisect_left(granted, end),
                     "new_customers": connected - previous})
        previous = connected
    return rows


def score_bands(db: Session) -> list[dict]:
    scores = [s for (s,) in db.execute(select(CustomerMetrics.opportunity_score).where(CustomerMetrics.opportunity_score >= MIN_SCORE))]
    total = len(scores) or 1
    bands = []
    for key, label, low, high in SCORE_BANDS:
        count = sum(low <= s <= high for s in scores)
        bands.append({"key": key, "label": label, "min": low, "max": high, "count": count, "share": round(count / total, 4)})
    return bands


def opportunity_distribution(db: Session) -> list[dict]:
    rows = db.execute(
        select(Opportunity.type, func.count(), func.sum(Opportunity.estimated_value), func.avg(Opportunity.score),
               func.sum(case((Opportunity.score >= 80, 1), else_=0)))
        .group_by(Opportunity.type)
    ).all()
    total = sum(r[1] for r in rows) or 1
    result = [{
        "type": t, "label": ref.OPPORTUNITY_TYPES[t]["label"], "title": ref.OPPORTUNITY_TYPES[t]["title"],
        "count": n, "value": round(float(v or 0), 2), "avg_score": round(float(avg or 0), 1),
        "high_priority": int(high or 0), "share": round(n / total, 4),
    } for t, n, v, avg, high in rows]
    return sorted(result, key=lambda r: -r["count"])


@router.get("/summary", response_model=PortfolioSummary)
def summary(db: Session = Depends(get_db)) -> dict:
    cm = CustomerMetrics
    customers, assets, investments, debt, avg_health, priority, with_opps = db.execute(select(
        func.count(), func.sum(cm.total_assets), func.sum(cm.total_investments), func.sum(cm.total_debt),
        func.avg(cm.health_score), func.sum(case((cm.opportunity_score >= 80, 1), else_=0)),
        func.sum(case((cm.opportunities_count > 0, 1), else_=0)),
    )).one()
    opp_count, opp_value, open_count = db.execute(select(
        func.count(), func.sum(Opportunity.estimated_value), func.sum(case((Opportunity.status.in_(OPEN_STATUSES), 1), else_=0)),
    )).one()
    mm = CustomerMonthlyMetric
    trend_rows = db.execute(
        select(mm.month,
               func.sum(mm.balance_primary + mm.balance_external + mm.investments_primary + mm.investments_external),
               func.sum(mm.investments_primary + mm.investments_external), func.sum(mm.debt_total),
               func.sum(mm.card_spend_primary + mm.card_spend_external),
               func.sum(mm.balance_external + mm.investments_external))
        .group_by(mm.month).order_by(mm.month)
    ).all()
    last = trend_rows[-1] if trend_rows else None
    connections = connection_trend(db, [r[0] for r in trend_rows])
    consents_last_month = connections[-1]["consents"] - connections[-2]["consents"] if len(connections) > 1 else 0
    return {
        "customers": customers or 0,
        "customers_with_opportunities": int(with_opps or 0),
        "customers_connected": db.scalar(
            select(func.count(func.distinct(Consent.customer_id))).where(Consent.status != "revoked")
        ) or 0,
        "new_connections_last_month": connections[-1]["new_customers"] if connections else 0,
        "customers_with_signals": db.scalar(select(func.count()).select_from(cm).where(cm.signals_count > 0)) or 0,
        "customers_high_severity": db.scalar(
            select(func.count(func.distinct(BehaviorSignal.customer_id))).where(BehaviorSignal.severity == "high")
        ) or 0,
        "total_assets": float(assets or 0),
        "total_investments": float(investments or 0),
        "total_debt": float(debt or 0),
        "opportunities": opp_count or 0,
        "open_opportunities": int(open_count or 0),
        "opportunity_value": float(opp_value or 0),
        "priority_customers": int(priority or 0),
        "institutions_connected": db.scalar(select(func.count(func.distinct(CustomerInstitution.institution_id)))) or 0,
        "avg_health_score": round(float(avg_health or 0), 1),
        "signals": db.scalar(select(func.count()).select_from(BehaviorSignal)) or 0,
        "active_consents": db.scalar(select(func.count()).select_from(Consent).where(Consent.status != "revoked")) or 0,
        "consents_last_month": consents_last_month,
        "external_asset_share": round(float(last[5] / last[1]), 4) if last and last[1] else 0.0,
        "reference_month": last[0] if last else None,
        "last_run": run_ref(latest_run(db)),
        "trend": [{"month": r[0], "total_assets": float(r[1]), "investments": float(r[2]), "debt": float(r[3]),
                   "card_spend": float(r[4])} for r in trend_rows],
        "connections_trend": connections,
        "score_bands": score_bands(db),
    }


@router.get("/opportunity-distribution", response_model=list[OpportunityTypeSummary])
def distribution(db: Session = Depends(get_db)) -> list[dict]:
    return opportunity_distribution(db)


@router.get("/priority-customers", response_model=list[PriorityCustomer])
def priority_customers(
    limit: int = Query(10, ge=1, le=50),
    type: str | None = Query(None, description="filtra pelo tipo da principal oportunidade"),  # noqa: A002
    db: Session = Depends(get_db),
) -> list[dict]:
    """Priority customers (top score >= 80). By type: highest value first. All types: a diversified
    selection (at most 2 per type, highest value within each type), ordered by score."""
    stmt = (
        select(Opportunity, Customer.name, Customer.segment, CustomerMetrics.health_score,
               CustomerMetrics.institutions_count, CustomerMetrics.last_sync_at)
        .join(Customer, Customer.customer_id == Opportunity.customer_id)
        .join(CustomerMetrics, CustomerMetrics.customer_id == Opportunity.customer_id)
        .where(Opportunity.score == CustomerMetrics.opportunity_score, Opportunity.status != "dismissed",
               Opportunity.score >= 80)
        .order_by(Opportunity.estimated_value.desc(), Opportunity.score.desc())
    )
    if type:
        stmt = stmt.where(Opportunity.type == type)
    rows = db.execute(stmt.limit(400)).all()
    picked, seen = [], set()
    per_type: dict[str, int] = defaultdict(int)
    for row in rows:
        opp = row[0]
        if opp.customer_id in seen or (not type and per_type[opp.type] >= 2):
            continue
        seen.add(opp.customer_id)
        per_type[opp.type] += 1
        picked.append(row)
        if len(picked) == limit:
            break
    if not type:
        picked.sort(key=lambda r: (-r[0].score, -r[0].estimated_value))
    ids = [r[0].customer_id for r in picked]
    links: dict[str, list[str]] = defaultdict(list)
    for cid, inst in db.execute(
        select(CustomerInstitution.customer_id, CustomerInstitution.institution_id)
        .where(CustomerInstitution.customer_id.in_(ids))
    ):
        links[cid].append(inst)
    types = opportunity_types_by_customer(db, ids)
    result = []
    for opp, name, segment, health, n_inst, last_sync in picked:
        institutions = sorted(links[opp.customer_id], key=lambda i: (i != PRIMARY, i))
        result.append({
            "customer_id": opp.customer_id, "name": name, "segment": segment, "health_score": health,
            "opportunity_id": opp.opportunity_id, "opportunity_score": opp.score, "opportunity_type": opp.type,
            "opportunity_label": ref.OPPORTUNITY_TYPES[opp.type]["label"], "estimated_value": opp.estimated_value,
            "summary": opp.summary, "reasons": [e for e in opp.evidence if e["kind"] == "support"][:4],
            "score_breakdown": opp.score_breakdown, "institutions_count": n_inst,
            "institutions": [institution_ref(i) for i in institutions], "opportunity_types": types[opp.customer_id],
            "last_update": last_sync,
        })
    return result


def opportunity_types_by_customer(db: Session, customer_ids: list[str]) -> dict[str, list[str]]:
    """Opportunity types of each customer (not dismissed), best score first."""
    types: dict[str, list[str]] = defaultdict(list)
    if not customer_ids:
        return types
    for cid, kind in db.execute(
        select(Opportunity.customer_id, Opportunity.type)
        .where(Opportunity.customer_id.in_(customer_ids), Opportunity.status != "dismissed")
        .order_by(Opportunity.score.desc(), Opportunity.opportunity_id)
    ):
        types[cid].append(kind)
    return types


@router.get("/wallet-share", response_model=WalletShare)
def wallet_share(db: Session = Depends(get_db)) -> dict:
    """Where the portfolio's money is: primary bank vs other institutions, per product."""
    ci = CustomerInstitution
    per_inst = db.execute(
        select(ci.institution_id, func.sum(ci.account_balance), func.sum(ci.investment_balance),
               func.sum(ci.card_spend_monthly), func.sum(ci.debt_balance))
        .group_by(ci.institution_id)
    ).all()
    products = [("balances", "Saldo em conta", 1), ("investments", "Investimentos", 2),
                ("card_spend", "Gasto com cartão (mês)", 3), ("debt", "Crédito / dívidas", 4)]
    rows = []
    for key, label, col in products:
        primary = sum(float(r[col] or 0) for r in per_inst if r[0] == PRIMARY)
        external_rows = sorted(((r[0], float(r[col] or 0)) for r in per_inst if r[0] != PRIMARY), key=lambda x: -x[1])
        external = sum(v for _, v in external_rows)
        total = primary + external
        rows.append({
            "product": key, "label": label, "primary": round(primary, 2), "external": round(external, 2),
            "primary_share": round(primary / total, 4) if total else 0.0,
            "top_external": [{"institution_id": i, "short_name": ref.INSTITUTION_BY_ID[i]["short_name"],
                              "brand_color": ref.INSTITUTION_BY_ID[i]["brand_color"], "value": round(v, 2),
                              "share": round(v / total, 4) if total else 0.0}
                             for i, v in external_rows[:4] if v > 0],
        })
    mm = CustomerMonthlyMetric
    trend = db.execute(
        select(mm.month, func.sum(mm.balance_primary), func.sum(mm.balance_external),
               func.sum(mm.investments_primary), func.sum(mm.investments_external),
               func.sum(mm.card_spend_primary), func.sum(mm.card_spend_external))
        .group_by(mm.month).order_by(mm.month)
    ).all()

    def share(a, b) -> float:
        a, b = float(a or 0), float(b or 0)
        return round(a / (a + b), 4) if a + b else 0.0

    return {
        "products": rows,
        "trend": [{"month": r[0], "balances": share(r[1], r[2]), "investments": share(r[3], r[4]),
                   "card_spend": share(r[5], r[6])} for r in trend],
    }


@router.get("/activity", response_model=list[ActivityItem])
def activity(db: Session = Depends(get_db)) -> list[dict]:
    """Relevant movements for the dashboard feed. Every number comes from the data; the time is
    when it happened (consent date) or when the engine detected it (last run)."""
    run = latest_run(db)
    detected_at = (run.finished_at or run.started_at) if run else dt.datetime.now().replace(microsecond=0)
    items: list[dict] = []

    last_month = db.scalar(select(func.max(CustomerMonthlyMetric.month)))
    if last_month:
        start, end = _month_bounds(last_month)
        firsts = select(func.min(Consent.granted_at).label("first")).group_by(Consent.customer_id).subquery()
        new_customers = db.scalar(select(func.count()).select_from(firsts).where(firsts.c.first >= start, firsts.c.first < end)) or 0
        latest_grant = db.scalar(select(func.max(Consent.granted_at))) or detected_at
        items.append({
            "kind": "connections", "tone": "green",
            "title": f"+{number(new_customers)} novos clientes com dados Open Finance",
            "detail": f"Primeiro consentimento em {month_label(last_month)}",
            "timestamp": latest_grant, "href": "/clientes?tab=novos",
        })

    total, high, value = db.execute(select(
        func.count(), func.sum(case((Opportunity.priority == "high", 1), else_=0)), func.sum(Opportunity.estimated_value),
    ).where(Opportunity.status.in_(OPEN_STATUSES))).one()
    if total:
        items.append({
            "kind": "opportunities", "tone": "amber",
            "title": f"{number(total)} oportunidades abertas na carteira",
            "detail": f"{number(high or 0)} de prioridade alta · {brl_compact(float(value or 0))} em valor potencial",
            "timestamp": detected_at, "href": "/oportunidades",
        })

    best = db.execute(
        select(Customer.customer_id, Customer.name, CustomerMetrics.opportunity_score, CustomerMetrics.top_opportunity_type)
        .join(CustomerMetrics, CustomerMetrics.customer_id == Customer.customer_id)
        .where(CustomerMetrics.top_opportunity_type.is_not(None))
        .order_by(CustomerMetrics.opportunity_score.desc(), CustomerMetrics.opportunity_value.desc())
        .limit(1)
    ).first()
    if best:
        label = ref.OPPORTUNITY_TYPES[best.top_opportunity_type]["label"].lower()
        items.append({
            "kind": "priority", "tone": "blue", "title": "Cliente com alto potencial identificado",
            "detail": f"{best.name} · score {best.opportunity_score} em {label}",
            "timestamp": detected_at, "href": f"/clientes/{best.customer_id}",
        })

    top_signal = db.execute(
        select(BehaviorSignal.signal_type, func.count()).where(BehaviorSignal.severity == "high")
        .group_by(BehaviorSignal.signal_type).order_by(func.count().desc(), BehaviorSignal.signal_type).limit(1)
    ).first()
    if top_signal:
        kind, count = top_signal
        items.append({
            "kind": "alerts", "tone": "red",
            "title": f"{number(count)} alertas de {SIGNAL_PHRASES.get(kind, SIGNAL_TYPES.get(kind, kind).lower())}",
            "detail": "Severidade alta · último trimestre comparado ao anterior",
            "timestamp": detected_at, "href": f"/clientes?signal={kind}",
        })

    expiring, customers = db.execute(
        select(func.count(), func.count(func.distinct(Consent.customer_id))).where(Consent.status == "expiring")
    ).one()
    if expiring:
        items.append({
            "kind": "consents", "tone": "violet",
            "title": f"{number(expiring)} consentimentos vencem em até 30 dias",
            "detail": f"{number(customers)} clientes precisam renovar o compartilhamento",
            "timestamp": detected_at, "href": "/configuracoes?tab=lgpd",
        })
    return items


@router.get("/recent-signals", response_model=list[RecentSignal])
def recent_signals(limit: int = Query(8, ge=1, le=50), db: Session = Depends(get_db)) -> list[dict]:
    """Most relevant behaviour changes, diversified by type (at most 2 per type)."""
    candidates = db.execute(
        select(BehaviorSignal, Customer.name)
        .join(Customer, Customer.customer_id == BehaviorSignal.customer_id)
        .order_by(SEVERITY_RANK, func.abs(func.coalesce(BehaviorSignal.change_pct, 1.0)).desc())
        .limit(400)
    ).all()
    type_rank = {kind: i for i, kind in enumerate(SIGNAL_TYPES)}
    per_type: dict[str, int] = defaultdict(int)
    rows = []
    for signal, name in sorted(candidates, key=lambda r: (SEVERITY_ORDER.get(r[0].severity, 3), type_rank.get(r[0].signal_type, 99))):
        if per_type[signal.signal_type] >= 2:
            continue
        per_type[signal.signal_type] += 1
        rows.append((signal, name))
        if len(rows) == limit:
            break
    return [{
        "signal_id": s.signal_id, "customer_id": s.customer_id, "customer_name": name, "signal_type": s.signal_type,
        "type_label": SIGNAL_TYPES.get(s.signal_type, s.signal_type), "severity": s.severity, "title": s.title,
        "description": s.description, "detected_at": s.detected_at,
    } for s, name in rows]
