"""Financial Health Score (0-100): a weighted, fully explainable combination of six components.

Each component maps one observable metric to 0-100 with a piecewise-linear curve, so the
analyst can always see *which number* produced *which points*.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from app.core.formatting import brl, number, pct
from app.pipeline.features import safe_div

COMPONENTS: list[dict] = [
    {"key": "cash_flow", "label": "Fluxo de caixa", "weight": 0.20,
     "metric": "Sobra mensal / renda (6m)"},
    {"key": "debt", "label": "Endividamento", "weight": 0.20,
     "metric": "Parcelas / renda e dívidas acima de 3% a.m."},
    {"key": "liquidity", "label": "Liquidez", "weight": 0.15,
     "metric": "Meses de despesas cobertos pelo saldo em conta"},
    {"key": "savings", "label": "Poupança", "weight": 0.15,
     "metric": "Aplicações líquidas / renda (6m)"},
    {"key": "investments", "label": "Investimentos", "weight": 0.15,
     "metric": "Carteira de investimentos / renda anual"},
    {"key": "income_stability", "label": "Estabilidade de renda", "weight": 0.15,
     "metric": "Variação da renda mensal (12m)"},
]

BANDS = [(80, "excellent", "Excelente"), (65, "healthy", "Saudável"), (45, "attention", "Atenção"), (0, "critical", "Crítica")]


def band_for(score: float) -> tuple[str, str]:
    for threshold, code, label in BANDS:
        if score >= threshold:
            return code, label
    return BANDS[-1][1], BANDS[-1][2]


def component_scores(f: pd.DataFrame) -> pd.DataFrame:
    comp = pd.DataFrame(index=f.index)
    comp["cash_flow"] = np.interp(f["surplus_ratio"], [-0.2, 0.0, 0.1, 0.3], [0, 40, 70, 100])
    base_debt = np.interp(f["debt_service_ratio"], [0.0, 0.1, 0.3, 0.5], [100, 85, 40, 0])
    expensive_ratio = safe_div(f["expensive_debt"], f["income_avg_6m"])
    penalty = np.where(f["expensive_debt"] > 0, np.interp(expensive_ratio, [0.0, 0.5, 2.0], [8, 15, 35]), 0)
    comp["debt"] = np.clip(base_debt - penalty, 0, 100)
    comp["liquidity"] = np.interp(f["liquidity_months"], [0.0, 1.0, 3.0, 6.0], [0, 30, 70, 100])
    comp["savings"] = np.interp(f["savings_rate"], [-0.05, 0.0, 0.03, 0.10, 0.20], [0, 30, 55, 85, 100])
    comp["investments"] = np.interp(f["investments_to_income"], [0.0, 0.1, 0.5, 1.5], [0, 30, 70, 100])
    stability = np.interp(f["income_cv"], [0.03, 0.10, 0.25, 0.50], [100, 85, 45, 10])
    comp["income_stability"] = stability * np.clip(f["months_with_income"] / 12, 0, 1)
    return comp.round(1)


def compute_health(features: pd.DataFrame) -> pd.DataFrame:
    """Returns health_score, health_band and the explained components for every customer."""
    comp = component_scores(features)
    score = sum(comp[c["key"]] * c["weight"] for c in COMPONENTS)
    out = pd.DataFrame(index=features.index)
    out["health_score"] = score.round().astype(int)
    out["health_band"] = [band_for(s)[0] for s in out["health_score"]]
    out["health_components"] = [
        explain_components(row, comp_row) for row, comp_row in zip(
            features.to_dict("records"), comp.to_dict("records"), strict=True
        )
    ]
    return out


def explain_components(f: dict, comp: dict) -> list[dict]:
    surplus = f["surplus_avg_6m"]
    dsr = f["debt_service_ratio"]
    expensive = f["expensive_debt"]
    liquidity_months = f["liquidity_months"]
    inv_net = f["investment_net_avg_6m"]
    cv = f["income_cv"]

    texts = {
        "cash_flow": (
            f"{'Sobra' if surplus >= 0 else 'Déficit de'} {pct(abs(f['surplus_ratio']))} da renda",
            f"Em média, {'sobram' if surplus >= 0 else 'faltam'} {brl(abs(surplus))} por mês após despesas e parcelas (últimos 6 meses).",
        ),
        "debt": (
            f"Parcelas = {pct(dsr)} da renda",
            f"Comprometimento de {pct(dsr)} da renda com parcelas"
            + (f"; {brl(expensive)} em dívidas caras (acima de 3% a.m.)." if expensive > 0 else "; nenhuma dívida cara identificada."),
        ),
        "liquidity": (
            f"{number(min(liquidity_months, 99), 1)} meses de reserva",
            f"Saldo em conta de {brl(f['liquid_total'])} cobre {number(min(liquidity_months, 99), 1)} meses de despesas.",
        ),
        "savings": (
            f"{pct(max(f['savings_rate'], 0), 1)} da renda aplicada",
            f"Aplica em média {brl(inv_net)} por mês em investimentos." if inv_net > 50
            else "Sem aplicações regulares relevantes nos últimos 6 meses.",
        ),
        "investments": (
            f"{number(f['investments_to_income'] * 12, 1)} meses de renda investidos",
            f"Carteira de {brl(f['investments_total'])}"
            + (f", {pct(f['external_investment_share'])} fora do banco principal." if f["investments_total"] > 0 else "."),
        ),
        "income_stability": (
            f"{int(f['months_with_income'])}/12 meses com renda regular",
            f"Variação típica da renda de {pct(cv)} entre meses"
            + (" — renda muito estável." if cv < 0.06 else " — renda variável." if cv > 0.2 else "."),
        ),
    }
    result = []
    for c in COMPONENTS:
        display, explanation = texts[c["key"]]
        result.append({
            "key": c["key"], "label": c["label"], "weight": c["weight"], "metric": c["metric"],
            "score": float(comp[c["key"]]), "points": round(float(comp[c["key"]]) * c["weight"], 1),
            "display": display, "explanation": explanation,
        })
    return result
