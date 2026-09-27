"""Assembles the Customer 360 view and the per-institution drill-down."""

from __future__ import annotations

import datetime as dt
from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.data import reference as ref
from app.data.generator import add_months
from app.models import (
    Account,
    BehaviorSignal,
    Consent,
    CreditCard,
    Customer,
    CustomerInstitution,
    CustomerMetrics,
    CustomerMonthlyMetric,
    Investment,
    Loan,
    Opportunity,
    Segment,
    Transaction,
)
from app.services.serializers import health_out, institution_ref, opportunity_out, signal_out

PRIMARY = ref.PRIMARY_INSTITUTION_ID
SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2}

TIMELINE_FIELDS = (
    "income", "expenses", "debt_payments", "investment_net", "available_cash", "balance_primary",
    "balance_external", "investments_primary", "investments_external", "debt_total", "net_worth",
    "card_spend_primary", "card_spend_external",
)


def _consent_item(c: Consent) -> dict:
    return {
        "consent_id": c.consent_id, "institution": institution_ref(c.institution_id), "status": c.status,
        "scopes": c.scopes, "purpose": c.purpose, "granted_at": c.granted_at, "expires_at": c.expires_at,
        "last_sync_at": c.last_sync_at,
    }


def _node(link: CustomerInstitution, consent_status: str | None) -> dict:
    return {
        "institution": institution_ref(link.institution_id), "products": link.products,
        "receives_salary": link.receives_salary, "account_balance": link.account_balance,
        "investment_balance": link.investment_balance, "debt_balance": link.debt_balance,
        "card_spend_monthly": link.card_spend_monthly, "card_limit": link.card_limit,
        "monthly_inflow": link.monthly_inflow, "monthly_outflow": link.monthly_outflow,
        "share_of_assets": link.share_of_assets,
        "consent_status": "internal" if link.institution_id == PRIMARY else consent_status,
    }


def timeline_rows(rows: list[CustomerMonthlyMetric]) -> list[dict]:
    return [
        {"month": r.month, **{k: getattr(r, k) for k in TIMELINE_FIELDS}, "salary_institution_id": r.salary_institution_id}
        for r in rows
    ]


def _relationship_map(links: list[CustomerInstitution]) -> list[dict]:
    categories = [
        ("salario", "Salário", None),
        ("conta", "Saldo em conta", "account_balance"),
        ("cartao", "Gasto com cartão (mês)", "card_spend_monthly"),
        ("investimentos", "Investimentos", "investment_balance"),
        ("emprestimo", "Empréstimos", "debt_balance"),
    ]
    rows = []
    for key, label, field in categories:
        if field is None:
            holders = [lk for lk in links if lk.receives_salary]
            primary = 1.0 if any(lk.institution_id == PRIMARY for lk in holders) else 0.0
            rows.append({
                "category": key, "label": label, "primary_value": primary, "external_value": 1.0 - primary if holders else 0.0,
                "primary_share": primary if holders else None,
                "held_at": [{"institution_id": lk.institution_id, "short_name": institution_ref(lk.institution_id)["short_name"],
                             "value": 1.0} for lk in holders],
            })
            continue
        values = [(lk.institution_id, float(getattr(lk, field))) for lk in links if getattr(lk, field) > 0]
        primary = sum(v for i, v in values if i == PRIMARY)
        external = sum(v for i, v in values if i != PRIMARY)
        total = primary + external
        rows.append({
            "category": key, "label": label, "primary_value": round(primary, 2), "external_value": round(external, 2),
            "primary_share": round(primary / total, 4) if total > 0 else None,
            "held_at": [{"institution_id": i, "short_name": institution_ref(i)["short_name"], "value": round(v, 2)}
                        for i, v in sorted(values, key=lambda x: -x[1])],
        })
    return rows


ASSET_GROUPS = [
    ("conta", "Conta corrente", "account", ("conta_corrente", "conta_pagamento", "conta_investimento")),
    ("poupanca", "Poupança", "account", ("poupanca",)),
    ("renda_fixa", "Renda fixa", "investment", ("cdb", "tesouro", "lci_lca", "fundo_rf")),
    ("renda_variavel", "Multimercado e ações", "investment", ("multimercado", "acoes")),
    ("previdencia", "Previdência", "investment", ("previdencia",)),
]


def _asset_breakdown(metrics: CustomerMetrics, accounts: list[Account], investments: list[Investment]) -> list[dict]:
    """Patrimony by product group. Investments are exact; the month-end account balance (the basis of
    every other number on the page) is split across account types by their current balances."""
    weights = defaultdict(float)
    for a in accounts:
        weights[a.account_type] += max(a.balance, 0.0)
    total_weight = sum(weights.values())
    balance = max(metrics.total_balance, 0.0)
    values = []
    for key, label, kind, types in ASSET_GROUPS:
        if kind == "account":
            share = sum(weights[t] for t in types) / total_weight if total_weight else (1.0 if key == "conta" else 0.0)
            value = balance * share
        else:
            value = sum(i.balance for i in investments if i.investment_type in types)
        values.append((key, label, value))
    total = sum(v for _, _, v in values) or 1.0
    return [{"key": k, "label": label, "value": round(v, 2), "share": round(v / total, 4)} for k, label, v in values]


def _products(accounts: list[Account], cards: list[CreditCard], investments: list[Investment], loans: list[Loan]) -> dict:
    by_inst = lambda rows: sorted(rows, key=lambda r: (r.institution_id != PRIMARY, r.institution_id))  # noqa: E731
    return {
        "accounts": [{"account_id": a.account_id, "institution": institution_ref(a.institution_id), "account_type": a.account_type,
                      "label": ref.ACCOUNT_TYPE_LABELS.get(a.account_type, a.account_type), "balance": a.balance,
                      "average_balance": a.average_balance, "opened_at": a.opened_at} for a in by_inst(accounts)],
        "cards": [{"card_id": c.card_id, "institution": institution_ref(c.institution_id), "brand": c.brand, "tier": c.tier,
                   "credit_limit": c.credit_limit, "monthly_bill": c.monthly_bill, "utilization": c.utilization}
                  for c in by_inst(cards)],
        "investments": [{"investment_id": i.investment_id, "institution": institution_ref(i.institution_id),
                         "investment_type": i.investment_type, "label": ref.INVESTMENT_TYPES[i.investment_type]["label"],
                         "product_name": i.product_name, "balance": i.balance, "risk_category": i.risk_category,
                         "liquidity": i.liquidity} for i in sorted(investments, key=lambda i: -i.balance)],
        "loans": [{"loan_id": ln.loan_id, "institution": institution_ref(ln.institution_id), "loan_type": ln.loan_type,
                   "label": ref.LOAN_TYPES[ln.loan_type]["label"], "balance": ln.balance, "interest_rate": ln.interest_rate,
                   "installment": ln.installment,
                   "remaining_months": int(ln.remaining_months) if ln.remaining_months is not None else None,
                   "reference_rate": ref.PRIMARY_REFERENCE_RATES.get(ln.loan_type),
                   "expensive": ln.interest_rate >= ref.EXPENSIVE_DEBT_RATE} for ln in sorted(loans, key=lambda ln: -ln.balance)],
    }


def _breakdown(income: float, expenses: float, debt: float, investments: float) -> dict:
    return {
        "income": round(income, 2), "expenses": round(expenses, 2), "debt_payments": round(debt, 2),
        "investments": round(investments, 2), "available": round(income - expenses - debt - investments, 2),
    }


def build_customer_360(db: Session, customer_id: str) -> dict | None:
    customer = db.get(Customer, customer_id)
    metrics = db.get(CustomerMetrics, customer_id)
    if customer is None or metrics is None:
        return None
    f = metrics.features
    links = db.scalars(select(CustomerInstitution).where(CustomerInstitution.customer_id == customer_id)).all()
    monthly = db.scalars(
        select(CustomerMonthlyMetric).where(CustomerMonthlyMetric.customer_id == customer_id)
        .order_by(CustomerMonthlyMetric.month)
    ).all()
    opportunities = db.scalars(
        select(Opportunity).where(Opportunity.customer_id == customer_id).order_by(Opportunity.score.desc())
    ).all()
    signals = sorted(
        db.scalars(select(BehaviorSignal).where(BehaviorSignal.customer_id == customer_id)).all(),
        key=lambda s: SEVERITY_ORDER.get(s.severity, 3),
    )
    consents = db.scalars(select(Consent).where(Consent.customer_id == customer_id)).all()
    segment = db.get(Segment, metrics.segment_id) if metrics.segment_id else None
    accounts = db.scalars(select(Account).where(Account.customer_id == customer_id)).all()
    cards = db.scalars(select(CreditCard).where(CreditCard.customer_id == customer_id)).all()
    investments = db.scalars(select(Investment).where(Investment.customer_id == customer_id)).all()
    loans = db.scalars(select(Loan).where(Loan.customer_id == customer_id)).all()

    consent_by_inst = {c.institution_id: c.status for c in consents}
    links_sorted = sorted(links, key=lambda lk: (lk.institution_id != PRIMARY,
                                                 -(lk.account_balance + lk.investment_balance + lk.debt_balance)))
    last = monthly[-1]
    recent = monthly[-6:]
    n = len(recent) or 1

    return {
        "customer": {
            "customer_id": customer.customer_id, "name": customer.name, "age_range": customer.age_range,
            "occupation_category": customer.occupation_category, "segment": customer.segment, "state": customer.state,
            "relationship_since": customer.relationship_since, "tenure_years": f.get("tenure_years", 0.0),
            "declared_income": customer.income, "primary_bank": institution_ref(customer.primary_bank),
        },
        "metrics": {
            "monthly_income": metrics.monthly_income, "monthly_expenses": metrics.monthly_expenses,
            "total_balance": metrics.total_balance, "total_investments": metrics.total_investments,
            "total_assets": metrics.total_assets, "total_debt": metrics.total_debt,
            "expensive_debt": metrics.expensive_debt, "net_worth": metrics.net_worth,
            "institutions_count": metrics.institutions_count, "external_asset_share": metrics.external_asset_share,
            "card_external_share": metrics.card_external_share, "debt_service_ratio": metrics.debt_service_ratio,
            "debt_level": metrics.debt_level, "opportunity_score": metrics.opportunity_score,
            "opportunities_count": metrics.opportunities_count, "opportunity_value": metrics.opportunity_value,
            "signals_count": metrics.signals_count,
        },
        "health": health_out(metrics.health_score, metrics.health_components),
        "segment": {"segment_id": segment.segment_id, "name": segment.name, "description": segment.description} if segment else None,
        "anomaly": {"is_anomaly": metrics.is_anomaly, "score": metrics.anomaly_score, "reasons": metrics.anomaly_reasons or []},
        "consent": {
            "active": sum(c.status == "active" for c in consents),
            "expiring": sum(c.status == "expiring" for c in consents),
            "revoked": sum(c.status == "revoked" for c in consents),
            "items": [_consent_item(c) for c in sorted(consents, key=lambda c: c.status)],
        },
        "ecosystem": [_node(lk, consent_by_inst.get(lk.institution_id)) for lk in links_sorted],
        "cash_flow": {
            "month": last.month,
            "last_month": _breakdown(last.income, last.expenses, last.debt_payments, last.investment_net),
            "average_6m": _breakdown(
                sum(r.income for r in recent) / n, sum(r.expenses for r in recent) / n,
                sum(r.debt_payments for r in recent) / n, sum(r.investment_net for r in recent) / n,
            ),
        },
        "timeline": timeline_rows(monthly),
        "opportunities": [opportunity_out(o) for o in opportunities],
        "signals": [signal_out(s) for s in signals],
        "relationship_map": _relationship_map(links),
        "asset_breakdown": _asset_breakdown(metrics, accounts, investments),
        "products": _products(accounts, cards, investments, loans),
        "last_sync_at": metrics.last_sync_at,
        "reference_month": last.month,
    }


def build_institution_drilldown(db: Session, customer_id: str, institution_id: str) -> dict | None:
    link = db.get(CustomerInstitution, (customer_id, institution_id))
    if link is None:
        return None
    consent = db.scalars(
        select(Consent).where(Consent.customer_id == customer_id, Consent.institution_id == institution_id)
    ).first()

    def rows(model, *order):
        stmt = select(model).where(model.customer_id == customer_id, model.institution_id == institution_id)
        return db.scalars(stmt.order_by(*order) if order else stmt).all()

    accounts = [{"account_id": a.account_id, "account_type": a.account_type,
                 "label": ref.ACCOUNT_TYPE_LABELS.get(a.account_type, a.account_type), "balance": a.balance,
                 "average_balance": a.average_balance, "opened_at": a.opened_at} for a in rows(Account)]
    cards = [{"card_id": c.card_id, "brand": c.brand, "tier": c.tier, "credit_limit": c.credit_limit,
              "monthly_bill": c.monthly_bill, "utilization": c.utilization} for c in rows(CreditCard)]
    investments = [{"investment_id": i.investment_id, "investment_type": i.investment_type,
                    "label": ref.INVESTMENT_TYPES[i.investment_type]["label"], "product_name": i.product_name,
                    "balance": i.balance, "risk_category": i.risk_category, "liquidity": i.liquidity}
                   for i in rows(Investment, Investment.balance.desc())]
    loans = [{"loan_id": ln.loan_id, "loan_type": ln.loan_type, "label": ref.LOAN_TYPES[ln.loan_type]["label"],
              "balance": ln.balance, "interest_rate": ln.interest_rate, "installment": ln.installment,
              "remaining_months": ln.remaining_months,
              "expensive": ln.interest_rate >= ref.EXPENSIVE_DEBT_RATE} for ln in rows(Loan, Loan.balance.desc())]

    txs = rows(Transaction, Transaction.date.desc(), Transaction.transaction_id.desc())
    recent_cutoff = add_months(txs[0].date.replace(day=1), -2) if txs else None  # last 3 closed months
    by_category: dict[str, float] = defaultdict(float)
    monthly: dict[dt.date, dict[str, float]] = defaultdict(lambda: {"inflow": 0.0, "outflow": 0.0})
    for t in txs:
        bucket = monthly[t.date.replace(day=1)]
        if t.amount >= 0:
            bucket["inflow"] += t.amount
        else:
            bucket["outflow"] += -t.amount
            spending = t.category not in ("aplicacao_investimento", "parcela_emprestimo")
            if spending and recent_cutoff and t.date >= recent_cutoff:
                by_category[t.category] += -t.amount
    spend_total = sum(by_category.values())

    return {
        "institution": institution_ref(institution_id),
        "relationship": _node(link, "internal" if institution_id == PRIMARY else (consent.status if consent else None)),
        "accounts": accounts,
        "cards": cards,
        "investments": investments,
        "loans": loans,
        "transactions": [{
            "transaction_id": t.transaction_id, "date": t.date, "description": t.description, "category": t.category,
            "category_label": ref.TRANSACTION_CATEGORY_LABELS.get(t.category, t.category),
            "transaction_type": t.transaction_type, "amount": t.amount,
        } for t in txs[:25]],
        "spending_by_category": [
            {"category": k, "label": ref.TRANSACTION_CATEGORY_LABELS.get(k, k), "value": round(v / 3, 2),
             "share": round(v / spend_total, 4) if spend_total else 0.0}
            for k, v in sorted(by_category.items(), key=lambda kv: -kv[1])
        ],
        "monthly": [{"month": m, "inflow": round(v["inflow"], 2), "outflow": round(v["outflow"], 2)}
                    for m, v in sorted(monthly.items())],
        "avg_monthly_spend": round(spend_total / 3, 2),
        "consent": _consent_item(consent) if consent else None,
    }
