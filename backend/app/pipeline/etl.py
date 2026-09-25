"""ETL: raw Open Finance records -> curated analytics tables.

* ``build_monthly_metrics``: customer x month cash flow (from transactions) joined with
  month-end positions (from balance snapshots).
* ``build_customer_institutions``: the customer <-> institution relationship graph with the
  products and money held at each institution.
"""

from __future__ import annotations

import datetime as dt

import numpy as np
import pandas as pd

from app.data import reference as ref

MONEY_COLUMNS = [
    "income", "expenses", "debt_payments", "investment_net", "available_cash", "outflows_primary",
    "card_spend_primary", "card_spend_external", "balance_primary", "balance_external",
    "investments_primary", "investments_external", "debt_total", "net_worth",
]


def _month_start(dates: pd.Series) -> pd.Series:
    stamps = pd.to_datetime(dates)
    return pd.Series(
        [dt.date(y, m, 1) for y, m in zip(stamps.dt.year, stamps.dt.month, strict=True)],
        index=dates.index,
    )


def build_monthly_metrics(
    transactions: pd.DataFrame,
    snapshots: pd.DataFrame,
    customer_ids: pd.Series,
    months: list[dt.date],
    primary_id: str,
) -> pd.DataFrame:
    tx = transactions
    month = _month_start(tx["date"])
    amount = tx["amount"].astype(float)
    absolute = amount.abs()
    category = tx["category"]
    is_card = tx["transaction_type"] == "cartao"
    is_primary = tx["institution_id"] == primary_id
    is_income = category.isin(ref.INCOME_CATEGORIES)

    flows = pd.DataFrame({
        "customer_id": tx["customer_id"],
        "month": month,
        "income": amount.where(is_income, 0.0),
        "expenses": absolute.where(category.isin(ref.ACCOUNT_EXPENSE_CATEGORIES) | is_card, 0.0),
        "debt_payments": absolute.where(category.isin(ref.DEBT_CATEGORIES), 0.0),
        "investment_net": absolute.where(category == "aplicacao_investimento", 0.0)
        - absolute.where(category == "resgate_investimento", 0.0),
        "outflows_primary": absolute.where(is_primary & (amount < 0) & (category != "aplicacao_investimento"), 0.0),
        "card_spend_primary": absolute.where(is_card & is_primary, 0.0),
        "card_spend_external": absolute.where(is_card & ~is_primary, 0.0),
    })
    flows = flows.groupby(["customer_id", "month"], as_index=False).sum()

    # Institution receiving the largest share of income in the month.
    income_tx = pd.DataFrame({
        "customer_id": tx["customer_id"], "month": month, "institution_id": tx["institution_id"], "amount": amount,
    })[is_income]
    salary = (
        income_tx.groupby(["customer_id", "month", "institution_id"], as_index=False)["amount"].sum()
        .sort_values("amount")
        .drop_duplicates(["customer_id", "month"], keep="last")
        .rename(columns={"institution_id": "salary_institution_id"})
        .drop(columns="amount")
    )

    snap = snapshots.assign(is_primary=snapshots["institution_id"] == primary_id)
    positions = snap.groupby(["customer_id", "month", "is_primary"])[
        ["account_balance", "investment_balance", "loan_balance"]
    ].sum().unstack("is_primary", fill_value=0.0)
    positions.columns = [f"{metric}_{'p' if flag else 'e'}" for metric, flag in positions.columns]
    for col in ("account_balance_p", "account_balance_e", "investment_balance_p", "investment_balance_e",
                "loan_balance_p", "loan_balance_e"):
        if col not in positions:
            positions[col] = 0.0
    positions = pd.DataFrame({
        "balance_primary": positions["account_balance_p"],
        "balance_external": positions["account_balance_e"],
        "investments_primary": positions["investment_balance_p"],
        "investments_external": positions["investment_balance_e"],
        "debt_total": positions["loan_balance_p"] + positions["loan_balance_e"],
    }).reset_index()

    grid = pd.MultiIndex.from_product([customer_ids, months], names=["customer_id", "month"]).to_frame(index=False)
    out = (
        grid.merge(flows, on=["customer_id", "month"], how="left")
        .merge(positions, on=["customer_id", "month"], how="left")
        .merge(salary, on=["customer_id", "month"], how="left")
    )
    numeric = [c for c in MONEY_COLUMNS if c in out.columns]
    out[numeric] = out[numeric].fillna(0.0)
    out["available_cash"] = out["income"] - out["expenses"] - out["debt_payments"] - out["investment_net"]
    out["net_worth"] = (
        out["balance_primary"] + out["balance_external"] + out["investments_primary"]
        + out["investments_external"] - out["debt_total"]
    )
    out[MONEY_COLUMNS] = out[MONEY_COLUMNS].round(2)
    out["salary_institution_id"] = out["salary_institution_id"].astype(object).where(
        out["salary_institution_id"].notna(), None
    )
    return out[["customer_id", "month", *MONEY_COLUMNS, "salary_institution_id"]]


def build_customer_institutions(
    accounts: pd.DataFrame,
    cards: pd.DataFrame,
    investments: pd.DataFrame,
    loans: pd.DataFrame,
    transactions: pd.DataFrame,
    monthly: pd.DataFrame,
    months: list[dt.date],
) -> pd.DataFrame:
    """One row per customer x institution with products and current money positions."""
    keys = ["customer_id", "institution_id"]
    acc = accounts.groupby(keys).agg(account_balance=("balance", "sum")).reset_index()
    inv = investments.groupby(keys).agg(investment_balance=("balance", "sum")).reset_index()
    debt = loans.groupby(keys).agg(debt_balance=("balance", "sum")).reset_index()
    crd = cards.groupby(keys).agg(card_spend_monthly=("monthly_bill", "sum"), card_limit=("credit_limit", "sum")).reset_index()

    # Average monthly flows over the last 3 months.
    recent_start = months[-3]
    tx = transactions[pd.to_datetime(transactions["date"]) >= pd.Timestamp(recent_start)]
    amount = tx["amount"].astype(float)
    flow = pd.DataFrame({
        "customer_id": tx["customer_id"], "institution_id": tx["institution_id"],
        "monthly_inflow": amount.clip(lower=0) / 3,
        "monthly_outflow": (-amount).clip(lower=0) / 3,
    }).groupby(keys, as_index=False).sum()

    last = monthly[monthly["month"] == months[-1]][["customer_id", "salary_institution_id"]]

    links = acc
    for frame in (inv, debt, crd, flow):
        links = links.merge(frame, on=keys, how="outer")
    money = ["account_balance", "investment_balance", "debt_balance", "card_spend_monthly", "card_limit",
             "monthly_inflow", "monthly_outflow"]
    links[money] = links[money].fillna(0.0).round(2)
    links = links.merge(last, on="customer_id", how="left")
    links["receives_salary"] = links["institution_id"] == links["salary_institution_id"]

    has_account = links.set_index(keys).index.isin(acc.set_index(keys).index)
    has_card = links.set_index(keys).index.isin(crd.set_index(keys).index)
    has_inv = links.set_index(keys).index.isin(inv.set_index(keys).index)
    has_loan = links.set_index(keys).index.isin(debt.set_index(keys).index)
    products = []
    for salary_flag, a, c, i, ln in zip(links["receives_salary"], has_account, has_card, has_inv, has_loan, strict=True):
        items = []
        if salary_flag:
            items.append("salario")
        if a:
            items.append("conta")
        if c:
            items.append("cartao")
        if i:
            items.append("investimentos")
        if ln:
            items.append("emprestimo")
        products.append(items)
    links["products"] = products

    assets = links["account_balance"] + links["investment_balance"]
    total = assets.groupby(links["customer_id"]).transform("sum").replace(0, np.nan)
    links["share_of_assets"] = (assets / total).fillna(0.0).round(4)
    return links[["customer_id", "institution_id", "products", "receives_salary", *money, "share_of_assets"]]
