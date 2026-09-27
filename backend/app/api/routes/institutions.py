"""Institutions: where the portfolio's money and products are, per participant."""

from __future__ import annotations

from collections import Counter, defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require
from app.data import reference as ref
from app.models import BalanceSnapshot, Customer, CustomerInstitution, CustomerMetrics
from app.services.serializers import institution_ref

router = APIRouter(prefix="/api/institutions", tags=["institutions"], dependencies=[Depends(require("portfolio:read"))])

PRIMARY = ref.PRIMARY_INSTITUTION_ID
PRODUCTS = ("salario", "conta", "cartao", "investimentos", "emprestimo")


def aggregate_by_institution(db: Session) -> dict[str, dict]:
    stats: dict[str, dict] = defaultdict(lambda: {
        "customers": 0, "salary_customers": 0, "account_balance": 0.0, "investment_balance": 0.0,
        "debt_balance": 0.0, "card_spend_monthly": 0.0, "products": Counter(),
    })
    for inst, products, salary, bal, inv, debt, card in db.execute(select(
        CustomerInstitution.institution_id, CustomerInstitution.products, CustomerInstitution.receives_salary,
        CustomerInstitution.account_balance, CustomerInstitution.investment_balance,
        CustomerInstitution.debt_balance, CustomerInstitution.card_spend_monthly,
    )):
        s = stats[inst]
        s["customers"] += 1
        s["salary_customers"] += int(bool(salary))
        s["account_balance"] += bal
        s["investment_balance"] += inv
        s["debt_balance"] += debt
        s["card_spend_monthly"] += card
        s["products"].update(products)
    return stats


@router.get("")
def list_institutions(db: Session = Depends(get_db)) -> dict:
    stats = aggregate_by_institution(db)
    total_assets = sum(s["account_balance"] + s["investment_balance"] for s in stats.values()) or 1.0
    total_card = sum(s["card_spend_monthly"] for s in stats.values()) or 1.0
    total_customers = db.scalar(select(func.count()).select_from(Customer)) or 1
    items = []
    for inst in ref.INSTITUTIONS:
        s = stats.get(inst["institution_id"])
        if not s:
            continue
        assets = s["account_balance"] + s["investment_balance"]
        items.append({
            "institution": institution_ref(inst["institution_id"]),
            "category_label": ref.INSTITUTION_CATEGORY_LABELS[inst["category"]],
            "customers": s["customers"], "customer_share": round(s["customers"] / total_customers, 4),
            "salary_customers": s["salary_customers"],
            "account_balance": round(s["account_balance"], 2), "investment_balance": round(s["investment_balance"], 2),
            "debt_balance": round(s["debt_balance"], 2), "card_spend_monthly": round(s["card_spend_monthly"], 2),
            "total_assets": round(assets, 2), "share_of_assets": round(assets / total_assets, 4),
            "share_of_card_spend": round(s["card_spend_monthly"] / total_card, 4),
            "products": {p: s["products"].get(p, 0) for p in PRODUCTS},
        })
    items.sort(key=lambda r: (not r["institution"]["is_primary"], -r["total_assets"]))
    return {"items": items, "total_assets": round(total_assets, 2), "total_card_spend": round(total_card, 2)}


@router.get("/{institution_id}")
def institution_detail(institution_id: str, top: int = Query(10, ge=1, le=50), db: Session = Depends(get_db)) -> dict:
    if institution_id not in ref.INSTITUTION_BY_ID:
        raise HTTPException(status_code=404, detail="Instituição não encontrada.")
    stats = aggregate_by_institution(db).get(institution_id)
    if stats is None:
        raise HTTPException(status_code=404, detail="Nenhum cliente conectado a esta instituição.")
    bs = BalanceSnapshot
    monthly = db.execute(
        select(bs.month, func.sum(bs.account_balance), func.sum(bs.investment_balance), func.sum(bs.loan_balance),
               func.sum(bs.card_bill), func.count(func.distinct(bs.customer_id)))
        .where(bs.institution_id == institution_id).group_by(bs.month).order_by(bs.month)
    ).all()
    ci = CustomerInstitution
    top_rows = db.execute(
        select(ci, Customer.name, CustomerMetrics.opportunity_score, CustomerMetrics.top_opportunity_type)
        .join(Customer, Customer.customer_id == ci.customer_id)
        .join(CustomerMetrics, CustomerMetrics.customer_id == ci.customer_id)
        .where(ci.institution_id == institution_id)
        .order_by((ci.account_balance + ci.investment_balance + ci.card_spend_monthly * 12).desc())
        .limit(top)
    ).all()
    # Primary-bank customers (salary at the primary) that also hold money here — relevant for competitors.
    overlap = None
    if institution_id != PRIMARY:
        salary_primary = select(ci.customer_id).where(ci.institution_id == PRIMARY, ci.receives_salary.is_(True))
        overlap = db.execute(
            select(func.count(), func.sum(ci.investment_balance), func.sum(ci.card_spend_monthly))
            .where(ci.institution_id == institution_id, ci.customer_id.in_(salary_primary))
        ).one()
    return {
        "institution": institution_ref(institution_id),
        "category_label": ref.INSTITUTION_CATEGORY_LABELS[ref.INSTITUTION_BY_ID[institution_id]["category"]],
        "customers": stats["customers"], "salary_customers": stats["salary_customers"],
        "account_balance": round(stats["account_balance"], 2), "investment_balance": round(stats["investment_balance"], 2),
        "debt_balance": round(stats["debt_balance"], 2), "card_spend_monthly": round(stats["card_spend_monthly"], 2),
        "products": {p: stats["products"].get(p, 0) for p in PRODUCTS},
        "monthly": [{"month": m, "account_balance": float(a), "investment_balance": float(i), "loan_balance": float(ln),
                     "card_bill": float(c), "customers": n} for m, a, i, ln, c, n in monthly],
        "top_customers": [{
            "customer_id": link.customer_id, "name": name, "products": link.products,
            "account_balance": link.account_balance, "investment_balance": link.investment_balance,
            "debt_balance": link.debt_balance, "card_spend_monthly": link.card_spend_monthly,
            "opportunity_score": score, "top_opportunity_type": top_type,
        } for link, name, score, top_type in top_rows],
        "primary_overlap": None if overlap is None else {
            "customers": int(overlap[0] or 0), "investments": float(overlap[1] or 0), "card_spend_monthly": float(overlap[2] or 0),
        },
    }
