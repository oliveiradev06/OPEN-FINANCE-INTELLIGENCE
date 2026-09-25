"""Feature engineering: one row per customer, computed from the curated monthly layer.

Windows (relative to the reference month):
* ``3m``      — last quarter (the most recent 3 closed months)
* ``prev3m``  — the quarter before it (used to measure behaviour changes)
* ``6m``/``12m`` — longer baselines for stability metrics
"""

from __future__ import annotations

import datetime as dt

import numpy as np
import pandas as pd

from app.data import reference as ref


def safe_div(num, den, default: float = 0.0):
    num = np.asarray(num, dtype=float)
    den = np.asarray(den, dtype=float)
    with np.errstate(divide="ignore", invalid="ignore"):
        out = np.where(np.abs(den) > 1e-9, num / np.where(np.abs(den) > 1e-9, den, 1.0), default)
    return out


def _wide(monthly: pd.DataFrame, column: str, index: pd.Index, months: list[dt.date], dtype=float) -> np.ndarray:
    pivot = monthly.pivot(index="customer_id", columns="month", values=column).reindex(index=index, columns=months)
    if dtype is float:
        return pivot.to_numpy(dtype=float, na_value=0.0)
    return pivot.to_numpy(dtype=object)


def build_features(
    customers: pd.DataFrame,
    monthly: pd.DataFrame,
    links: pd.DataFrame,
    loans: pd.DataFrame,
    cards: pd.DataFrame,
    months: list[dt.date],
    reference_date: dt.date,
    primary_id: str,
) -> pd.DataFrame:
    idx = pd.Index(sorted(customers["customer_id"]), name="customer_id")

    def w(column: str) -> np.ndarray:
        return _wide(monthly, column, idx, months)

    inc, exp, debt_pay, inv_net = w("income"), w("expenses"), w("debt_payments"), w("investment_net")
    out_p, cp, ce = w("outflows_primary"), w("card_spend_primary"), w("card_spend_external")
    bp, be, ip, ie, debt = (w("balance_primary"), w("balance_external"), w("investments_primary"),
                            w("investments_external"), w("debt_total"))
    salary = _wide(monthly, "salary_institution_id", idx, months, dtype=object)

    f = pd.DataFrame(index=idx)

    # Income ---------------------------------------------------------------------------------
    f["income_avg_6m"] = inc[:, -6:].mean(1)
    f["income_avg_12m"] = inc.mean(1)
    f["income_avg_3m"] = inc[:, -3:].mean(1)
    f["income_avg_prev3m"] = inc[:, -6:-3].mean(1)
    f["income_change"] = safe_div(f["income_avg_3m"] - f["income_avg_prev3m"], f["income_avg_prev3m"])
    median = np.median(inc, axis=1)
    mad = np.median(np.abs(inc - median[:, None]), axis=1)
    f["income_cv"] = np.where(median > 0, 1.4826 * mad / np.where(median > 0, median, 1), 1.0)
    f["months_with_income"] = (inc > 0.5 * median[:, None]).sum(1)

    # Spending & cash flow -----------------------------------------------------------------
    f["expenses_avg_3m"] = exp[:, -3:].mean(1)
    f["expenses_avg_prev3m"] = exp[:, -6:-3].mean(1)
    f["expenses_avg_6m"] = exp[:, -6:].mean(1)
    f["expenses_change"] = safe_div(f["expenses_avg_3m"] - f["expenses_avg_prev3m"], f["expenses_avg_prev3m"])
    f["debt_payments_avg_3m"] = debt_pay[:, -3:].mean(1)
    f["investment_net_avg_6m"] = inv_net[:, -6:].mean(1)
    surplus = inc[:, -6:] - exp[:, -6:] - debt_pay[:, -6:]
    f["surplus_avg_6m"] = surplus.mean(1)
    f["surplus_ratio"] = safe_div(f["surplus_avg_6m"], f["income_avg_6m"])
    f["available_cash_avg_6m"] = (surplus - inv_net[:, -6:]).mean(1)
    f["months_positive_cash_flow"] = (surplus > 0).sum(1)

    # Primary-bank balance behaviour ----------------------------------------------------------
    f["balance_primary_avg_6m"] = bp[:, -6:].mean(1)
    f["balance_primary_min_6m"] = bp[:, -6:].min(1)
    f["balance_primary_cv_6m"] = safe_div(bp[:, -6:].std(1), f["balance_primary_avg_6m"], default=1.0)
    f["balance_primary_last"] = bp[:, -1]
    f["balance_primary_avg_3m"] = bp[:, -3:].mean(1)
    f["balance_primary_avg_prev3m"] = bp[:, -6:-3].mean(1)
    f["balance_primary_change"] = safe_div(
        f["balance_primary_avg_3m"] - f["balance_primary_avg_prev3m"], f["balance_primary_avg_prev3m"]
    )
    f["months_balance_stable"] = (bp[:, -6:] >= 0.8 * f["balance_primary_avg_6m"].to_numpy()[:, None]).sum(1)
    f["outflows_primary_avg_6m"] = out_p[:, -6:].mean(1)
    f["turnover_primary"] = safe_div(f["outflows_primary_avg_6m"], f["balance_primary_avg_6m"], default=99.0)
    f["balance_external_last"] = be[:, -1]
    f["liquid_total"] = bp[:, -1] + be[:, -1]

    # Investments -----------------------------------------------------------------------------
    f["investments_primary"] = ip[:, -1]
    f["investments_external"] = ie[:, -1]
    f["investments_total"] = ip[:, -1] + ie[:, -1]
    f["investments_primary_prev3m"] = ip[:, -6:-3].mean(1)
    f["investments_external_prev3m"] = ie[:, -6:-3].mean(1)
    f["investments_primary_change"] = safe_div(ip[:, -1] - f["investments_primary_prev3m"], f["investments_primary_prev3m"])
    f["investments_external_change"] = safe_div(ie[:, -1] - f["investments_external_prev3m"], f["investments_external_prev3m"])
    f["external_investment_share"] = safe_div(ie[:, -1], f["investments_total"])

    # Debt ------------------------------------------------------------------------------------
    f["debt_total"] = debt[:, -1]
    f["debt_total_prev3m"] = debt[:, -6:-3].mean(1)
    f["debt_change"] = safe_div(f["debt_total"] - f["debt_total_prev3m"], f["debt_total_prev3m"])

    loans = loans.assign(
        expensive=loans["interest_rate"] >= ref.EXPENSIVE_DEBT_RATE,
        monthly_interest=loans["balance"] * loans["interest_rate"] / 100,
        is_primary=loans["institution_id"] == primary_id,
    )
    expensive = loans[loans["expensive"]]
    g = expensive.groupby("customer_id")
    f["expensive_debt"] = g["balance"].sum().reindex(idx, fill_value=0.0)
    f["expensive_debt_interest"] = g["monthly_interest"].sum().reindex(idx, fill_value=0.0)
    f["expensive_debt_rate"] = safe_div(f["expensive_debt_interest"] * 100, f["expensive_debt"])
    f["loans_primary"] = loans[loans["is_primary"]].groupby("customer_id")["balance"].sum().reindex(idx, fill_value=0.0)
    f["loans_external"] = loans[~loans["is_primary"]].groupby("customer_id")["balance"].sum().reindex(idx, fill_value=0.0)
    f["installments_total"] = loans.groupby("customer_id")["installment"].sum().reindex(idx, fill_value=0.0)

    # Credit cards ------------------------------------------------------------------------------
    f["card_spend_primary_3m"] = cp[:, -3:].mean(1)
    f["card_spend_external_3m"] = ce[:, -3:].mean(1)
    f["card_spend_total_3m"] = f["card_spend_primary_3m"] + f["card_spend_external_3m"]
    f["card_external_share_3m"] = safe_div(f["card_spend_external_3m"], f["card_spend_total_3m"])
    f["card_spend_external_prev3m"] = ce[:, -6:-3].mean(1)
    prev_total = cp[:, -6:-3].mean(1) + f["card_spend_external_prev3m"]
    f["card_external_share_prev3m"] = safe_div(f["card_spend_external_prev3m"], prev_total)
    f["card_external_spend_change"] = safe_div(
        f["card_spend_external_3m"] - f["card_spend_external_prev3m"], f["card_spend_external_prev3m"]
    )
    card_primary = cards[cards["institution_id"] == primary_id]
    f["has_primary_card"] = idx.isin(card_primary["customer_id"])
    f["cards_count"] = cards.groupby("customer_id").size().reindex(idx, fill_value=0)
    f["card_utilization_max"] = cards.groupby("customer_id")["utilization"].max().reindex(idx, fill_value=0.0)

    # Salary / income channel ------------------------------------------------------------------
    last_salary = salary[:, -1]
    before_window = salary[:, -4]
    f["salary_institution"] = last_salary
    f["salary_institution_prev"] = before_window
    f["salary_at_primary"] = last_salary == primary_id
    f["months_salary_at_primary"] = (salary == primary_id).sum(1)
    changed = (last_salary != before_window) & pd.notna(last_salary) & pd.notna(before_window)
    f["salary_changed"] = changed
    change_month = []
    for row, flag in zip(salary, changed, strict=True):
        if not flag:
            change_month.append(None)
            continue
        k = next(i for i in range(len(months) - 3, len(months)) if row[i] != row[-4])
        change_month.append(months[k].isoformat())
    f["salary_change_month"] = change_month

    # Relationship ---------------------------------------------------------------------------------
    f["institutions_count"] = links.groupby("customer_id").size().reindex(idx, fill_value=1)
    cust = customers.set_index("customer_id").reindex(idx)
    since = pd.to_datetime(cust["relationship_since"])
    f["tenure_years"] = ((pd.Timestamp(reference_date) - since).dt.days / 365.25).round(2).to_numpy()
    f["declared_income"] = cust["income"].astype(float).to_numpy()

    # Composite ratios ------------------------------------------------------------------------------
    f["total_assets"] = f["liquid_total"] + f["investments_total"]
    f["net_worth"] = f["total_assets"] - f["debt_total"]
    f["external_asset_share"] = safe_div(f["balance_external_last"] + f["investments_external"], f["total_assets"])
    f["debt_service_ratio"] = safe_div(f["debt_payments_avg_3m"], f["income_avg_6m"])
    f["dti"] = safe_div(f["debt_total"], 12 * f["income_avg_6m"])
    f["liquidity_months"] = safe_div(f["liquid_total"], f["expenses_avg_6m"])
    f["savings_rate"] = safe_div(f["investment_net_avg_6m"], f["income_avg_6m"])
    f["investments_to_income"] = safe_div(f["investments_total"], 12 * f["income_avg_6m"])

    dsr = f["debt_service_ratio"]
    heavy_expensive = f["expensive_debt"] > 1.5 * f["income_avg_6m"]
    f["debt_level"] = np.select(
        [(dsr >= 0.4) | heavy_expensive, (dsr >= 0.2) | (f["expensive_debt"] > 0)],
        ["high", "moderate"],
        default="low",
    )

    float_cols = f.select_dtypes(include="float").columns
    f[float_cols] = f[float_cols].round(4)
    return f


def build_contexts(links: pd.DataFrame, loans: pd.DataFrame, cards: pd.DataFrame,
                   investments: pd.DataFrame) -> dict[str, dict]:
    """Per-customer detail used by the rules to write evidence (institution names, loans...)."""
    ctx: dict[str, dict] = {}
    for name, frame in (("institutions", links), ("loans", loans), ("cards", cards), ("investments", investments)):
        for row in frame.to_dict("records"):
            entry = ctx.setdefault(row["customer_id"], {"institutions": [], "loans": [], "cards": [], "investments": []})
            entry[name].append(row)
    return ctx
