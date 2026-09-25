"""Portfolio-level insights generated automatically after every engine run.

Each insight keeps the exact list of customers that produced its number, so the analyst can
drill down from the sentence to the customers (no approximation between text and list).
"""

from __future__ import annotations

import datetime as dt

import pandas as pd

from app.core.formatting import brl_compact, month_label, number, pct
from app.data import reference as ref

PRIMARY = ref.PRIMARY_INSTITUTION_ID


def _monthly_series(monthly: pd.DataFrame, months: list[dt.date], columns: dict[str, str]) -> list[dict]:
    totals = monthly.groupby("month")[list(columns)].sum().reindex(months)
    return [
        {"label": month_label(m), **{alias: round(float(totals.loc[m, col]), 2) for col, alias in columns.items()}}
        for m in months
    ]


def generate_insights(
    features: pd.DataFrame,
    health: pd.DataFrame,
    signals: pd.DataFrame,
    opportunities: pd.DataFrame,
    monthly: pd.DataFrame,
    links: pd.DataFrame,
    anomalies: pd.DataFrame,
    months: list[dt.date],
    now: dt.datetime,
) -> tuple[list[dict], list[tuple[str, str]]]:
    insights: list[dict] = []
    members: list[tuple[str, str]] = []

    def add(insight_id: str, *, category: str, severity: str, title: str, description: str, value: float,
            value_format: str, customers: list[str], filters: dict | None = None, chart: dict | None = None) -> None:
        if not customers and value == 0:
            return
        insights.append({
            "insight_id": insight_id, "category": category, "severity": severity, "title": title,
            "description": description, "headline_value": round(float(value), 2), "headline_format": value_format,
            "affected_customers": len(customers), "filters": {"insight": insight_id, **(filters or {})},
            "chart": chart, "generated_at": now,
        })
        members.extend((insight_id, cid) for cid in sorted(set(customers)))

    def with_signal(kind: str) -> list[str]:
        return signals.loc[signals["signal_type"] == kind, "customer_id"].tolist()

    def with_opportunity(kind: str) -> pd.DataFrame:
        return opportunities[opportunities["type"] == kind]

    f = features

    # 1. Competitor card spending growth -------------------------------------------------------
    growth = f[(f["card_external_spend_change"] >= 0.3) & (f["card_spend_external_3m"] >= 500)
               & (f["card_spend_external_prev3m"] >= 300)]
    add("competitor_spending_growth", category="concorrencia", severity="risk",
        title=f"{number(len(growth))} clientes aumentaram em mais de 30% seus gastos em instituições concorrentes.",
        description=(f"Gasto médio desses clientes em cartões de outras instituições passou de "
                     f"{brl_compact(growth['card_spend_external_prev3m'].mean() if len(growth) else 0)} para "
                     f"{brl_compact(growth['card_spend_external_3m'].mean() if len(growth) else 0)} por mês no último trimestre."),
        value=len(growth), value_format="number", customers=growth.index.tolist(),
        chart={"type": "area", "data": _monthly_series(monthly, months, {"card_spend_primary": "Banco principal",
                                                                          "card_spend_external": "Concorrentes"})})

    # 2. Idle cash ---------------------------------------------------------------------------
    idle = with_opportunity("idle_cash")
    add("idle_cash_total", category="liquidez", severity="opportunity",
        title=f"{brl_compact(idle['estimated_value'].sum())} estão mantidos como saldo ocioso.",
        description=(f"{number(len(idle))} clientes mantêm saldo estável e pouco movimentado em conta corrente, "
                     "acima da folga operacional — em média "
                     f"{brl_compact(idle['estimated_value'].mean() if len(idle) else 0)} por cliente."),
        value=idle["estimated_value"].sum(), value_format="currency", customers=idle["customer_id"].tolist(),
        filters={"opportunity_type": "idle_cash"})

    # 3. External investment concentration ------------------------------------------------------
    concentrated = f[(f["external_investment_share"] > 0.8) & (f["investments_external"] >= 5000)]
    add("external_investment_concentration", category="concorrencia", severity="opportunity",
        title=f"{number(len(concentrated))} clientes possuem concentração de investimentos superior a 80% em instituições externas.",
        description=(f"Juntos, somam {brl_compact(concentrated['investments_external'].sum())} investidos fora do banco "
                     f"(média de {pct(concentrated['external_investment_share'].mean() if len(concentrated) else 0)} da carteira)."),
        value=len(concentrated), value_format="number", customers=concentrated.index.tolist())

    # 4. Expensive debt that could be paid with available cash ------------------------------------
    debt = with_opportunity("debt_optimization")
    add("expensive_debt_with_cash", category="endividamento", severity="opportunity",
        title=(f"{brl_compact(debt['estimated_value'].sum())} em dívidas caras poderiam ser reduzidas com saldo disponível "
               f"por {number(len(debt))} clientes."),
        description=("Clientes pagam juros acima de 3% a.m. enquanto mantêm saldo em conta suficiente para amortizar "
                     "parte relevante da dívida."),
        value=debt["estimated_value"].sum(), value_format="currency", customers=debt["customer_id"].tolist(),
        filters={"opportunity_type": "debt_optimization"})

    # 5. Salary portability away from the primary bank ----------------------------------------------
    moved = f[f["salary_changed"] & (f["salary_institution_prev"] == PRIMARY)]
    destinations = moved["salary_institution"].map(lambda i: ref.INSTITUTION_BY_ID.get(i, {}).get("short_name", i)).value_counts()
    add("salary_portability", category="relacionamento", severity="risk",
        title=f"{number(len(moved))} clientes transferiram o crédito de salário para outra instituição nos últimos 3 meses.",
        description="Principais destinos: " + ", ".join(f"{name} ({n})" for name, n in destinations.head(3).items()) + "."
        if len(destinations) else "Nenhuma portabilidade de salário detectada.",
        value=len(moved), value_format="number", customers=moved.index.tolist(), filters={"signal": "salary_change"},
        chart={"type": "bar", "data": [{"label": name, "value": int(n)} for name, n in destinations.items()]})

    # 6. Competitor holding the largest share of external card spend ---------------------------------
    ext_cards = links[(links["institution_id"] != PRIMARY) & (links["card_spend_monthly"] > 0)]
    by_inst = ext_cards.groupby("institution_id")["card_spend_monthly"].sum().sort_values(ascending=False)
    if len(by_inst):
        top_inst = by_inst.index[0]
        top_share = by_inst.iloc[0] / by_inst.sum()
        top_name = ref.INSTITUTION_BY_ID[top_inst]["short_name"]
        add("top_competitor_card", category="concorrencia", severity="info",
            title=f"{top_name} concentra {pct(top_share)} dos gastos em cartões concorrentes da carteira.",
            description=(f"São {brl_compact(by_inst.iloc[0])} por mês em cartões {top_name}; o total em cartões de outras "
                         f"instituições é de {brl_compact(by_inst.sum())} por mês."),
            value=top_share, value_format="percent",
            customers=ext_cards.loc[ext_cards["institution_id"] == top_inst, "customer_id"].tolist(),
            filters={"institution_id": top_inst},
            chart={"type": "bar", "data": [{"label": ref.INSTITUTION_BY_ID[i]["short_name"], "value": round(float(v), 2)}
                                           for i, v in by_inst.head(6).items()]})

    # 7. Fragmented relationship ----------------------------------------------------------------------
    rel = with_opportunity("relationship")
    add("fragmented_relationship", category="relacionamento", severity="opportunity",
        title=f"{number(len(rel))} clientes recebem salário no banco, mas mantêm investimentos, cartão e crédito majoritariamente fora.",
        description=f"Esses clientes somam {brl_compact(rel['estimated_value'].sum())} em recursos em outras instituições.",
        value=len(rel), value_format="number", customers=rel["customer_id"].tolist(),
        filters={"opportunity_type": "relationship"})

    # 8. Primary share of the portfolio's investments over time ------------------------------------------
    inv = monthly.groupby("month")[["investments_primary", "investments_external"]].sum().reindex(months)
    share = inv["investments_primary"] / (inv["investments_primary"] + inv["investments_external"])
    first, last = float(share.iloc[0]), float(share.iloc[-1])
    add("investment_share_trend", category="concorrencia", severity="risk" if last < first else "info",
        title=f"A participação do banco nos investimentos da carteira passou de {pct(first)} para {pct(last)} em 12 meses.",
        description=(f"Investimentos no banco: {brl_compact(inv['investments_primary'].iloc[-1])}; em outras instituições: "
                     f"{brl_compact(inv['investments_external'].iloc[-1])}."),
        value=last, value_format="percent", customers=[],
        chart={"type": "line", "data": [{"label": month_label(m), "value": round(float(s), 4)} for m, s in share.items()]})

    # 9. Credit portability ---------------------------------------------------------------------------
    credit = with_opportunity("credit")
    add("credit_portability", category="endividamento", severity="opportunity",
        title=(f"{brl_compact(credit['estimated_value'].sum())} em crédito contratado em concorrentes com taxa acima "
               "da referência do banco."),
        description=f"{number(len(credit))} clientes poderiam economizar com portabilidade — decisão sujeita à análise de crédito.",
        value=credit["estimated_value"].sum(), value_format="currency", customers=credit["customer_id"].tolist(),
        filters={"opportunity_type": "credit"})

    # 10. Spending surge ---------------------------------------------------------------------------------
    surge = with_signal("spending_increase")
    add("spending_surge", category="comportamento", severity="attention",
        title=f"{number(len(surge))} clientes aumentaram seus gastos em mais de 25% no último trimestre.",
        description="Mudança relevante de comportamento — pode indicar novo momento de vida ou pressão sobre o orçamento.",
        value=len(surge), value_format="number", customers=surge, filters={"signal": "spending_increase"})

    # 11. Financial stress (care, never automatic action) ------------------------------------------------
    critical = health[health["health_band"] == "critical"]
    add("financial_stress", category="bem_estar", severity="attention",
        title=f"{number(len(critical))} clientes com saúde financeira crítica.",
        description=("Recomenda-se abordagem consultiva e educação financeira. O sistema não toma decisões automáticas "
                     "de limite ou crédito."),
        value=len(critical), value_format="number", customers=critical.index.tolist(), filters={"health_band": "critical"})

    # 12. Anomalies (Isolation Forest) ---------------------------------------------------------------
    flagged = anomalies[anomalies["is_anomaly"]]
    add("behavior_anomalies", category="comportamento", severity="attention",
        title=f"{number(len(flagged))} clientes apresentam comportamento financeiro atípico no trimestre.",
        description="Detectado por Isolation Forest sobre variações de gastos, saldo, renda, investimentos e dívida.",
        value=len(flagged), value_format="number", customers=flagged.index.tolist(), filters={"anomaly": True})

    for rank, insight in enumerate(insights, start=1):
        insight["rank"] = rank
    return insights, members
