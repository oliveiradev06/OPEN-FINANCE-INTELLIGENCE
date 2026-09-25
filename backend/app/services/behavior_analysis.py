"""Behavioural change detection: compares the last quarter against the previous one.

Every signal carries the before/after numbers that triggered it, so it can be shown as
evidence and reused by the retention rule and by portfolio insights.
"""

from __future__ import annotations

import datetime as dt

import pandas as pd

from app.core.formatting import brl, month_label, pct
from app.data import reference as ref

SIGNAL_TYPES: dict[str, str] = {
    "salary_change": "Entrada de salário mudou",
    "investment_outflow": "Investimentos transferidos",
    "balance_drop": "Queda de saldo no banco principal",
    "competitor_card_increase": "Uso de cartão concorrente aumentou",
    "spending_increase": "Aumento de gastos",
    "income_drop": "Queda de renda",
    "debt_increase": "Aumento de endividamento",
}

THRESHOLDS = {
    "spending_increase": 0.25,  # +25% expenses (quarter over quarter)
    "balance_drop": -0.30,  # -30% average primary balance
    "competitor_card_share_pp": 0.10,  # +10 p.p. of card spend outside the primary bank
    "competitor_card_spend": 0.30,  # or +30% of external card spend
    "investment_outflow": -0.30,  # -30% primary investments
    "income_drop": -0.25,
    "debt_increase": 0.30,
}


def _severity(magnitude: float, medium: float, high: float) -> str:
    if magnitude >= high:
        return "high"
    if magnitude >= medium:
        return "medium"
    return "low"


def _name(inst_id: str | None) -> str:
    if not inst_id:
        return "—"
    return ref.INSTITUTION_BY_ID.get(inst_id, {}).get("short_name", inst_id)


def detect_customer_signals(f: dict, detected_at: dt.date) -> list[dict]:
    signals: list[dict] = []

    def add(kind: str, severity: str, title: str, description: str, before: float | None,
            after: float | None, change: float | None, **details) -> None:
        signals.append({
            "signal_type": kind, "severity": severity, "title": title, "description": description,
            "metric_before": None if before is None else round(float(before), 2),
            "metric_after": None if after is None else round(float(after), 2),
            "change_pct": None if change is None else round(float(change), 4),
            "detected_at": detected_at, "details": details,
        })

    if f["salary_changed"]:
        month = dt.date.fromisoformat(f["salary_change_month"]) if f["salary_change_month"] else detected_at
        prev_name, new_name = _name(f["salary_institution_prev"]), _name(f["salary_institution"])
        severity = "high" if f["salary_institution_prev"] == ref.PRIMARY_INSTITUTION_ID else "medium"
        add("salary_change", severity, "Entrada de salário mudou",
            f"O crédito de salário migrou de {prev_name} para {new_name} em {month_label(month, full=True)}.",
            None, None, None, from_institution=f["salary_institution_prev"], to_institution=f["salary_institution"],
            month=month.isoformat())

    change = f["investments_primary_change"]
    if change <= THRESHOLDS["investment_outflow"] and f["investments_primary_prev3m"] >= 5000:
        moved = f["investments_primary_prev3m"] - f["investments_primary"]
        grew = f["investments_external"] - f["investments_external_prev3m"]
        text = f"{brl(moved)} saíram dos investimentos no banco principal ({pct(change)})"
        text += f"; a carteira externa cresceu {brl(grew)}." if grew > 0.3 * moved else "."
        add("investment_outflow", _severity(-change, 0.45, 0.65), "Investimentos foram transferidos", text,
            f["investments_primary_prev3m"], f["investments_primary"], change, external_growth=round(grew, 2))

    change = f["balance_primary_change"]
    if change <= THRESHOLDS["balance_drop"] and f["balance_primary_avg_prev3m"] >= 3000:
        add("balance_drop", _severity(-change, 0.4, 0.55), f"Saldo caiu {pct(-change)}",
            f"Saldo médio no banco principal passou de {brl(f['balance_primary_avg_prev3m'])} para "
            f"{brl(f['balance_primary_avg_3m'])} no último trimestre.",
            f["balance_primary_avg_prev3m"], f["balance_primary_avg_3m"], change)

    share_delta = f["card_external_share_3m"] - f["card_external_share_prev3m"]
    spend_change = f["card_external_spend_change"]
    if f["card_spend_external_3m"] >= 500 and (
        share_delta >= THRESHOLDS["competitor_card_share_pp"]
        or (spend_change >= THRESHOLDS["competitor_card_spend"] and f["card_spend_external_prev3m"] >= 400)
    ):
        if share_delta >= THRESHOLDS["competitor_card_share_pp"]:
            desc = (f"A participação de cartões de outras instituições passou de {pct(f['card_external_share_prev3m'])} "
                    f"para {pct(f['card_external_share_3m'])} dos gastos com cartão.")
        else:
            desc = (f"Gastos em cartões concorrentes subiram {pct(spend_change)}: de {brl(f['card_spend_external_prev3m'])} "
                    f"para {brl(f['card_spend_external_3m'])} por mês.")
        add("competitor_card_increase", _severity(max(share_delta * 2, spend_change), 0.3, 0.5),
            "Uso do cartão concorrente aumentou", desc,
            f["card_spend_external_prev3m"], f["card_spend_external_3m"], spend_change,
            share_before=round(f["card_external_share_prev3m"], 4), share_after=round(f["card_external_share_3m"], 4))

    change = f["expenses_change"]
    if change >= THRESHOLDS["spending_increase"] and f["expenses_avg_prev3m"] >= 800:
        add("spending_increase", _severity(change, 0.35, 0.5), f"Gastos aumentaram {pct(change)}",
            f"A média mensal de gastos passou de {brl(f['expenses_avg_prev3m'])} para {brl(f['expenses_avg_3m'])}.",
            f["expenses_avg_prev3m"], f["expenses_avg_3m"], change)

    change = f["income_change"]
    if change <= THRESHOLDS["income_drop"] and f["income_avg_prev3m"] >= 1500:
        add("income_drop", _severity(-change, 0.35, 0.5), f"Renda caiu {pct(-change)}",
            f"A renda média passou de {brl(f['income_avg_prev3m'])} para {brl(f['income_avg_3m'])} por mês.",
            f["income_avg_prev3m"], f["income_avg_3m"], change)

    change = f["debt_change"]
    if change >= THRESHOLDS["debt_increase"] and f["debt_total"] >= 3000 and f["debt_total_prev3m"] > 0:
        add("debt_increase", _severity(change, 0.5, 1.0), f"Endividamento aumentou {pct(change)}",
            f"Saldo devedor passou de {brl(f['debt_total_prev3m'])} para {brl(f['debt_total'])}.",
            f["debt_total_prev3m"], f["debt_total"], change)
    elif f["debt_total_prev3m"] == 0 and f["debt_total"] >= 3000:
        add("debt_increase", "medium", "Nova dívida contratada",
            f"Cliente passou a ter {brl(f['debt_total'])} em operações de crédito no último trimestre.",
            0.0, f["debt_total"], None)

    return signals


def detect_signals(features: pd.DataFrame, detected_at: dt.date) -> pd.DataFrame:
    rows: list[dict] = []
    for cid, f in zip(features.index, features.to_dict("records"), strict=True):
        for i, signal in enumerate(detect_customer_signals(f, detected_at), start=1):
            rows.append({"signal_id": f"SIG-{cid[4:]}-{i:02d}", "customer_id": cid, **signal})
    columns = ["signal_id", "customer_id", "signal_type", "severity", "title", "description",
               "metric_before", "metric_after", "change_pct", "detected_at", "details"]
    return pd.DataFrame(rows, columns=columns)
