"""Synthetic Open Finance dataset generator.

Two steps per customer:

1. **Profile** — demographics, latent behaviours (saver, external investor, card migration,
   expensive debt, churn risk...) and a product plan are drawn from calibrated distributions.
2. **Materialization** — the profile becomes raw Open Finance records: accounts, credit cards,
   investments, loans, 12 months of transactions and month-end balance snapshots per institution.

The engines never see the latent behaviours: they must *rediscover* them from the raw data,
exactly as they would with real Open Finance feeds.

The first customer IDs are hand-written demo personas (see ``_personas``) so that a product
demo always has a strong example of each opportunity type. They go through the same pipeline.
"""

from __future__ import annotations

import datetime as dt
from collections import defaultdict
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from app.data import reference as ref

SALARY_COMPETITORS = {"itau": 0.26, "bradesco": 0.18, "santander": 0.15, "bb": 0.14, "caixa": 0.10, "nubank": 0.10, "inter": 0.07}
CARD_COMPETITORS = {"nubank": 0.33, "itau": 0.13, "inter": 0.13, "c6": 0.10, "santander": 0.09, "bradesco": 0.08, "mercadopago": 0.07, "bb": 0.07}
INVEST_COMPETITORS = {"btg": 0.29, "xp": 0.29, "itau": 0.12, "inter": 0.10, "nubank": 0.08, "bradesco": 0.05, "santander": 0.04, "bb": 0.03}
LOAN_COMPETITORS = {"itau": 0.2, "bradesco": 0.18, "santander": 0.18, "bb": 0.14, "caixa": 0.12, "inter": 0.1, "c6": 0.08}
EXTRA_ACCOUNT_INSTITUTIONS = {"nubank": 0.3, "mercadopago": 0.25, "inter": 0.2, "c6": 0.15, "caixa": 0.1}

MAIN_ACCOUNT_TYPE = {
    "banco": "conta_corrente",
    "banco_digital": "conta_corrente",
    "investimentos": "conta_investimento",
    "fintech": "conta_pagamento",
}
SEASONALITY = {12: 1.16, 1: 1.10, 2: 1.03, 7: 1.04}  # December, January (IPVA/IPTU/school), July


def add_months(day: dt.date, n: int) -> dt.date:
    years, month0 = divmod(day.month - 1 + n, 12)
    return dt.date(day.year + years, month0 + 1, 1)


def pmt(rate_pct: float, n_months: int, principal: float) -> float:
    r = rate_pct / 100
    if n_months <= 0:
        return principal
    return principal * r / (1 - (1 + r) ** -n_months)


# ------------------------------------------------------------------------------------------
# Profile
# ------------------------------------------------------------------------------------------


@dataclass
class CardPlan:
    institution_id: str
    weight: float  # share of spend inside its group (primary cards vs external cards)
    limit: float
    brand: str
    tier: str


@dataclass
class InvestmentPlan:
    institution_id: str
    investment_type: str
    product_name: str
    balance: float  # current balance


@dataclass
class LoanPlan:
    institution_id: str
    loan_type: str
    balance: float  # current outstanding balance
    rate: float  # % a.m.
    remaining_months: int | None  # None = revolving
    start_idx: int = 0  # month index in which the credit was taken


@dataclass
class Profile:
    customer_id: str
    name: str
    age_range: str
    occupation: str
    state: str
    income: float
    income_vol: float
    thirteenth: bool
    relationship_since: dt.date
    salary_institution: str
    salary_move_to: str | None = None
    salary_move_idx: int | None = None
    expense_ratio: float = 0.7
    spending_surge: float = 1.0  # multiplier on the last 3 months
    card_share: float = 0.0  # share of expenses paid with credit cards
    cards: list[CardPlan] = field(default_factory=list)
    ext_card_share_start: float = 0.0  # external share of card spend before the last quarter
    ext_card_share_end: float = 0.0  # external share in the last quarter
    balances: dict[str, float] = field(default_factory=dict)  # main account month-end target
    balance_noise: float = 0.14
    primary_drain: float = 1.0  # primary balance level reached at the last month (1 = no drain)
    investments: list[InvestmentPlan] = field(default_factory=list)
    invest_outflow: float = 0.0  # share of primary investments moved out in the last 2 months
    invest_outflow_to: str | None = None
    loans: list[LoanPlan] = field(default_factory=list)
    extra_accounts: list[tuple[str, str, float]] = field(default_factory=list)  # (inst, type, target)
    revoked: list[str] = field(default_factory=list)
    stressed: bool = False


@dataclass
class GeneratedDataset:
    institutions: pd.DataFrame
    customers: pd.DataFrame
    accounts: pd.DataFrame
    credit_cards: pd.DataFrame
    investments: pd.DataFrame
    loans: pd.DataFrame
    transactions: pd.DataFrame
    balance_snapshots: pd.DataFrame
    consents: pd.DataFrame
    months: list[dt.date]
    reference_date: dt.date

    def counts(self) -> dict[str, int]:
        return {
            name: len(getattr(self, name))
            for name in (
                "institutions", "customers", "accounts", "credit_cards", "investments",
                "loans", "transactions", "balance_snapshots", "consents",
            )
        }


# ------------------------------------------------------------------------------------------
# Generator
# ------------------------------------------------------------------------------------------


class SyntheticDataGenerator:
    def __init__(
        self,
        n_customers: int = 5000,
        n_months: int = 12,
        seed: int = 42,
        reference_date: dt.date | None = None,
        primary_institution_id: str = ref.PRIMARY_INSTITUTION_ID,
    ) -> None:
        self.n_customers = n_customers
        self.n_months = n_months
        self.rng = np.random.default_rng(seed)
        self.reference_date = reference_date or dt.date.today()
        self.reference_dt = dt.datetime.combine(self.reference_date, dt.time(7, 30))
        last_complete_month = add_months(self.reference_date.replace(day=1), -1)
        self.months = [add_months(last_complete_month, -k) for k in range(n_months - 1, -1, -1)]
        self.primary = primary_institution_id
        self._seq: dict[str, int] = defaultdict(int)

        self._customers: list[dict] = []
        self._accounts: list[dict] = []
        self._cards: list[dict] = []
        self._investments: list[dict] = []
        self._loans: list[dict] = []
        self._consents: list[dict] = []
        self._snapshots: list[tuple] = []
        self._transactions: list[tuple] = []

    # -- helpers ---------------------------------------------------------------------------

    def _id(self, prefix: str, width: int = 6) -> str:
        self._seq[prefix] += 1
        return f"{prefix}-{self._seq[prefix]:0{width}d}"

    def _pick(self, weighted: dict[str, float] | Sequence[str], exclude: Sequence[str] = ()) -> str:
        if isinstance(weighted, dict):
            options = [k for k in weighted if k not in exclude]
            weights = np.array([weighted[k] for k in options], dtype=float)
        else:
            options = [k for k in weighted if k not in exclude]
            weights = np.ones(len(options))
        return str(self.rng.choice(options, p=weights / weights.sum()))

    def _pick_many(self, weighted: dict[str, float], n: int, exclude: Sequence[str] = ()) -> list[str]:
        chosen: list[str] = []
        for _ in range(n):
            chosen.append(self._pick(weighted, exclude=[*exclude, *chosen]))
        return chosen

    def _u(self, low: float, high: float) -> float:
        return float(self.rng.uniform(low, high))

    def _random_name(self, female: bool) -> str:
        rng = self.rng
        first = str(rng.choice(ref.FIRST_NAMES_F if female else ref.FIRST_NAMES_M))
        if rng.random() < 0.12:
            second = str(rng.choice(ref.COMPOUND_F if female else ref.COMPOUND_M))
            if second != first:
                first = f"{first} {second}"
        surname = str(rng.choice(ref.SURNAMES))
        if rng.random() < 0.55:
            other = str(rng.choice(ref.SURNAMES))
            if other != surname:
                surname = f"{other} {surname}"
        return f"{first} {surname}"

    def _tier(self, income: float) -> str:
        if income >= 20000:
            return "Black"
        if income >= 9000:
            return "Platinum"
        if income >= 4000:
            return "Gold"
        return "Internacional"

    def _card(self, inst: str, weight: float, income: float, limit_mult: tuple[float, float] = (0.7, 2.4)) -> CardPlan:
        limit = round(max(800.0, income * self._u(*limit_mult)), -2)
        return CardPlan(inst, weight, limit, str(self.rng.choice(ref.CARD_BRANDS, p=[0.46, 0.44, 0.10])), self._tier(income))

    def _investment(self, inst: str, inv_type: str, balance: float) -> InvestmentPlan:
        products = ref.INVESTMENT_TYPES[inv_type]["products"]
        return InvestmentPlan(inst, inv_type, str(self.rng.choice(products)), round(balance, 2))

    # -- public API ------------------------------------------------------------------------

    def generate(self) -> GeneratedDataset:
        personas = self._personas()
        for idx in range(self.n_customers):
            profile = personas[idx]() if idx < len(personas) else self._random_profile(idx)
            self._materialize(profile)
        return self._to_dataset()

    # -- random profiles -------------------------------------------------------------------

    def _random_profile(self, idx: int) -> Profile:
        rng = self.rng
        occupations = list(ref.OCCUPATIONS)
        occ = self._pick({o: ref.OCCUPATIONS[o]["weight"] for o in occupations})
        if occ == "Aposentado":
            age_idx = int(rng.choice([4, 5], p=[0.3, 0.7]))
        else:
            age_idx = int(rng.choice(6, p=[0.09, 0.29, 0.28, 0.19, 0.11, 0.04]))
        occ_ref = ref.OCCUPATIONS[occ]
        income_age = (0.55, 0.85, 1.05, 1.15, 1.10, 0.95)[age_idx]
        income = float(np.clip(rng.lognormal(np.log(occ_ref["median"] * income_age), occ_ref["sigma"]), 1600, 95000))
        tenure_years = self._u(0.4, (3, 9, 16, 22, 25, 25)[age_idx])
        digital = float(np.clip(rng.beta(2, 2) + (0.25, 0.2, 0.08, -0.05, -0.15, -0.25)[age_idx], 0, 1))
        affluence = min(income / 15000, 1.0)

        salary_primary_p = 0.5 + (0.12 if tenure_years > 5 else 0.0)
        salary_inst = self.primary if rng.random() < salary_primary_p else self._pick(SALARY_COMPETITORS)

        p = Profile(
            customer_id=f"CUS-{idx + 1:05d}",
            name=self._random_name(bool(rng.random() < 0.5)),
            age_range=ref.AGE_RANGES[age_idx],
            occupation=occ,
            state=self._pick(ref.STATES),
            income=round(income, 2),
            income_vol=occ_ref["vol"],
            thirteenth=occ_ref["thirteenth"],
            relationship_since=self.reference_date - dt.timedelta(days=int(tenure_years * 365.25)),
            salary_institution=salary_inst,
        )

        # Latent behaviours (the engines never see these flags).
        stressed = rng.random() < 0.07
        idle = (not stressed) and rng.random() < (0.11 if salary_inst == self.primary else 0.04) * (1.3 if age_idx >= 3 else 1.0)
        ext_investor = (not stressed) and rng.random() < 0.08 + 0.2 * affluence
        expensive_debt = stressed or rng.random() < 0.10 + (0.08 if income < 5000 else 0.0)
        debt_with_cash = expensive_debt and not stressed and rng.random() < 0.5
        card_migration = rng.random() < 0.10 + 0.18 * digital
        competitor_loan = rng.random() < 0.10
        churn = rng.random() < 0.07
        p.stressed = stressed

        # Spending ---------------------------------------------------------------------
        if stressed:
            p.expense_ratio = self._u(0.95, 1.12)
        elif idle:
            p.expense_ratio = self._u(0.45, 0.70)
        else:
            p.expense_ratio = float(np.clip(rng.normal(0.68, 0.10), 0.42, 0.95))
        if rng.random() < 0.07:
            p.spending_surge = self._u(1.3, 1.65)

        # Credit cards -----------------------------------------------------------------
        if rng.random() < 0.92:
            primary_card = rng.random() < (0.72 if salary_inst == self.primary else 0.5)
            n_ext = int(rng.choice([0, 1, 2], p=[0.30, 0.52, 0.18]))
            if card_migration:
                n_ext = max(n_ext, 1)
            if not primary_card and n_ext == 0:
                primary_card = True
            limit_mult = (0.4, 1.0) if stressed else (0.7, 2.4)
            if primary_card:
                p.cards.append(self._card(self.primary, 1.0, income, limit_mult))
            weights = rng.dirichlet(np.ones(n_ext) * 2) if n_ext else []
            for inst, w in zip(self._pick_many(CARD_COMPETITORS, n_ext), weights, strict=False):
                p.cards.append(self._card(inst, float(w), income, limit_mult))
            p.card_share = self._u(0.30, 0.60)
            if not primary_card:
                start = end = 1.0
            elif n_ext == 0:
                start = end = 0.0
            elif card_migration:
                end = self._u(0.64, 0.93)
                start = end - self._u(0.12, 0.28) if rng.random() < 0.4 else end + rng.normal(0, 0.03)
            else:
                end = self._u(0.08, 0.50)
                start = end + rng.normal(0, 0.04)
            p.ext_card_share_start = float(np.clip(start, 0, 1))
            p.ext_card_share_end = float(np.clip(end, 0, 1))

        # Wealth & liquidity -----------------------------------------------------------
        age_wealth = (0.25, 0.6, 1.0, 1.5, 2.0, 2.3)[age_idx]
        wealth = income * float(rng.lognormal(np.log(5.0), 0.95)) * age_wealth
        if stressed:
            wealth *= 0.08
        liquid = wealth * float(rng.beta(1.6, 4.0))
        p.balance_noise = 0.22  # checking balances swing month to month

        if idle:
            primary_liquid = max(17000.0, income * self._u(2.6, 6.0)) * (1 + 0.5 * affluence)
            liquid = primary_liquid / self._u(0.82, 0.95)
            wealth = max(wealth, liquid * self._u(1.1, 1.8))
            p.balance_noise = self._u(0.025, 0.12)
        else:
            primary_share = self._u(0.55, 0.9) if salary_inst == self.primary else self._u(0.15, 0.45)
            primary_liquid = liquid * primary_share

        # Loans --------------------------------------------------------------------------
        card_insts = [c.institution_id for c in p.cards]
        if expensive_debt:
            n_loans = int(rng.integers(2, 4)) if stressed else 1
            options = {"cheque_especial": 0.35, "credito_pessoal": 0.4}
            if card_insts:
                options["rotativo_cartao"] = 0.25
            for loan_type in self._pick_many(options, min(n_loans, len(options))):
                if loan_type == "rotativo_cartao":
                    inst = str(rng.choice(card_insts))
                elif loan_type == "cheque_especial":
                    inst = salary_inst if rng.random() < 0.6 else self.primary
                else:
                    inst = self.primary if rng.random() < 0.3 else self._pick(LOAN_COMPETITORS)
                balance = float(np.clip(income * self._u(0.6, 2.2) * (1.4 if stressed else 1.0), 1500, 60000))
                low, high = ref.LOAN_TYPES[loan_type]["rate"]
                remaining = None if ref.LOAN_TYPES[loan_type].get("revolving") else int(rng.integers(8, 37))
                start_idx = int(rng.integers(3, self.n_months - 1)) if (remaining and rng.random() < 0.35) else 0
                p.loans.append(LoanPlan(inst, loan_type, round(balance, 2), round(self._u(low, high), 2), remaining, start_idx))
            if debt_with_cash:
                debt = sum(ln.balance for ln in p.loans)
                needed = debt * self._u(1.15, 2.3)
                if liquid < needed:
                    extra = needed - liquid
                    liquid += extra
                    primary_liquid += extra * (0.8 if salary_inst == self.primary else 0.4)
        if competitor_loan:
            loan_type = self._pick({"credito_pessoal": 0.4, "consignado": 0.35, "veiculo": 0.25})
            spread_rates = {"credito_pessoal": (4.2, 6.2), "consignado": (1.85, 2.15), "veiculo": (1.9, 2.4)}
            balances = {
                "credito_pessoal": income * self._u(1.0, 3.0),
                "consignado": income * self._u(2.0, 8.0),
                "veiculo": self._u(20000, 80000) * (0.6 + affluence),
            }
            p.loans.append(LoanPlan(
                self._pick(LOAN_COMPETITORS), loan_type, round(float(np.clip(balances[loan_type], 5000, 250000)), 2),
                round(self._u(*spread_rates[loan_type]), 2), int(rng.integers(12, 61)),
            ))
        if rng.random() < 0.03 + 0.07 * (income > 7000):
            inst = self.primary if rng.random() < 0.4 else self._pick({"itau": 0.3, "bradesco": 0.25, "santander": 0.2, "caixa": 0.25})
            p.loans.append(LoanPlan(inst, "imobiliario", round(self._u(90000, 520000) * (0.5 + affluence), 2),
                                    round(self._u(0.82, 1.1), 2), int(rng.integers(60, 301))))
        if rng.random() < 0.10:
            inst = self.primary if rng.random() < 0.45 else self._pick(LOAN_COMPETITORS)
            rate = self._u(1.4, 1.6) if inst == self.primary else self._u(1.45, 1.75)
            p.loans.append(LoanPlan(inst, "veiculo", round(self._u(15000, 70000) * (0.6 + affluence), 2), round(rate, 2), int(rng.integers(10, 49))))
        if occ in ("Servidor público", "Aposentado", "Assalariado CLT") and rng.random() < 0.10:
            inst = self.primary if rng.random() < 0.55 else self._pick(LOAN_COMPETITORS)
            rate = self._u(1.5, 1.65) if inst == self.primary else self._u(1.55, 1.8)
            p.loans.append(LoanPlan(inst, "consignado", round(income * self._u(1.5, 6.0), 2), round(rate, 2), int(rng.integers(12, 73))))
        if rng.random() < 0.06:
            p.loans.append(LoanPlan(self.primary, "credito_pessoal", round(income * self._u(0.5, 2.0), 2),
                                    round(self._u(3.1, 3.6), 2), int(rng.integers(6, 30))))

        # Investments --------------------------------------------------------------------
        invested = max(wealth - liquid, 0.0)
        invests = invested > 1500 and rng.random() < 0.42 + 0.45 * affluence
        if ext_investor:
            invests = True
            invested = max(invested, max(25000.0, income * self._u(3.0, 10.0)))
        if invests:
            if ext_investor:
                ext_share = self._u(0.80, 0.97)
            elif rng.random() < 0.30 + 0.2 * digital:
                ext_share = float(rng.beta(2, 3.5))
            else:
                ext_share = 0.0
            internal = invested * (1 - ext_share)
            external = invested * ext_share
            primary_types = {"cdb": 0.35, "lci_lca": 0.15, "fundo_rf": 0.15, "previdencia": 0.15, "tesouro": 0.1, "multimercado": 0.1}
            if internal >= 500:
                kinds = self._pick_many(primary_types, 1 if internal < 20000 or rng.random() < 0.5 else 2)
                for kind, w in zip(kinds, rng.dirichlet(np.ones(len(kinds)) * 3), strict=True):
                    p.investments.append(self._investment(self.primary, kind, internal * float(w)))
            if external >= 500:
                pool = {"btg": 0.42, "xp": 0.42, "itau": 0.08, "inter": 0.08} if ext_investor else INVEST_COMPETITORS
                insts = self._pick_many(pool, 1 if external < 40000 or rng.random() < 0.6 else 2)
                ext_types = {"cdb": 0.25, "tesouro": 0.2, "acoes": 0.18, "multimercado": 0.15, "fundo_rf": 0.12, "lci_lca": 0.1}
                for inst, w in zip(insts, rng.dirichlet(np.ones(len(insts)) * 3), strict=True):
                    kinds = self._pick_many(ext_types, 1 if external * w < 30000 else 2)
                    for kind, w2 in zip(kinds, rng.dirichlet(np.ones(len(kinds)) * 3), strict=True):
                        p.investments.append(self._investment(inst, kind, external * float(w) * float(w2)))

        # Churn risk (salary portability, balance drain, investment outflow) ---------------
        if churn:
            applied = False
            if salary_inst == self.primary and rng.random() < 0.6:
                p.salary_move_to = self._pick(SALARY_COMPETITORS)
                p.salary_move_idx = self.n_months - int(rng.integers(2, 4))
                applied = True
            primary_investments = [i for i in p.investments if i.institution_id == self.primary]
            if primary_investments and rng.random() < 0.6:
                p.invest_outflow = self._u(0.45, 0.95)
                p.invest_outflow_to = self._pick({"btg": 0.3, "xp": 0.3, "itau": 0.15, "inter": 0.15, "nubank": 0.1})
                applied = True
            if rng.random() < 0.7 or not applied:
                p.primary_drain = self._u(0.3, 0.62)

        # Account balances ---------------------------------------------------------------
        p.balances[self.primary] = primary_liquid
        others = [salary_inst] if salary_inst != self.primary else []
        others += [c.institution_id for c in p.cards if c.institution_id != self.primary]
        others += [inst for inst, _type in self._extra_accounts(digital)]
        others = list(dict.fromkeys(others))
        remaining = max(liquid - primary_liquid, 0.0)
        if others:
            weights = rng.dirichlet(np.ones(len(others)) * 1.5)
            if salary_inst in others:
                weights[others.index(salary_inst)] += 1.0
                weights /= weights.sum()
            for inst, w in zip(others, weights, strict=True):
                p.balances[inst] = remaining * float(w)
        if rng.random() < 0.2:
            p.extra_accounts.append((self.primary, "poupanca", self._u(500, 12000) * (0.5 + affluence)))
        elif rng.random() < 0.08:
            p.extra_accounts.append(("caixa", "poupanca", self._u(500, 9000)))

        # A small share of customers revoked one consent: that institution's data is absent.
        if rng.random() < 0.015:
            used = {self.primary, *p.balances, *(c.institution_id for c in p.cards)}
            candidates = [i["institution_id"] for i in ref.INSTITUTIONS if i["institution_id"] not in used]
            if candidates:
                p.revoked.append(str(rng.choice(candidates)))
        return p

    def _extra_accounts(self, digital: float) -> list[tuple[str, str]]:
        n = int(self.rng.choice([0, 1, 2], p=[0.5 - 0.2 * digital, 0.38 + 0.1 * digital, 0.12 + 0.1 * digital]))
        return [(inst, "conta_pagamento") for inst in self._pick_many(EXTRA_ACCOUNT_INSTITUTIONS, n)]

    # -- demo personas ---------------------------------------------------------------------

    def _personas(self) -> list[Callable[[], Profile]]:
        """Hand-written profiles that make each opportunity type easy to demo."""
        ref_date = self.reference_date
        n = self.n_months

        def joao() -> Profile:
            # Salary at the primary bank, but investments at BTG, card spend on Nubank and a loan
            # at Inter: investment + debt optimization + credit + migration + relationship.
            return Profile(
                customer_id="CUS-00001", name="João Silva", age_range="35-44", occupation="Assalariado CLT",
                state="SP", income=9200.0, income_vol=0.015, thirteenth=True,
                relationship_since=ref_date.replace(year=ref_date.year - 4, month=3, day=14),
                salary_institution=self.primary, expense_ratio=0.595, card_share=0.55,
                cards=[CardPlan(self.primary, 1.0, 12000, "Mastercard", "Platinum"),
                       CardPlan("nubank", 1.0, 15000, "Mastercard", "Platinum")],
                ext_card_share_start=0.60, ext_card_share_end=0.72,
                balances={self.primary: 12600.0, "nubank": 1400.0, "btg": 350.0, "inter": 900.0},
                balance_noise=0.07,
                investments=[InvestmentPlan(self.primary, "cdb", "CDB Liquidez Diária 100% CDI", 8000.0),
                             InvestmentPlan("btg", "cdb", "CDB 110% CDI 2028", 46000.0),
                             InvestmentPlan("btg", "tesouro", "Tesouro IPCA+ 2035", 39000.0)],
                loans=[LoanPlan("inter", "credito_pessoal", 7800.0, 5.4, 20)],
            )

        def maria() -> Profile:
            # Classic idle cash: ~R$ 28 mil parked in the checking account for months.
            return Profile(
                customer_id="CUS-00002", name="Maria Souza", age_range="45-54", occupation="Servidor público",
                state="MG", income=9800.0, income_vol=0.01, thirteenth=True,
                relationship_since=dt.date(2014, 6, 2), salary_institution=self.primary,
                expense_ratio=0.78, card_share=0.32,
                cards=[CardPlan(self.primary, 1.0, 14000, "Visa", "Platinum")],
                balances={self.primary: 28400.0, "nubank": 700.0, "mercadopago": 250.0},
                balance_noise=0.025,
                extra_accounts=[("caixa", "poupanca", 6200.0)],
            )

        def lucas() -> Profile:
            # R$ 18,5 mil of expensive revolving debt while R$ 22 mil sits in the primary bank.
            return Profile(
                customer_id="CUS-00003", name="Lucas Santos", age_range="25-34", occupation="Profissional liberal",
                state="RJ", income=7600.0, income_vol=0.08, thirteenth=False,
                relationship_since=dt.date(2020, 9, 21), salary_institution=self.primary,
                expense_ratio=0.66, card_share=0.5,
                cards=[CardPlan("santander", 1.0, 9000, "Visa", "Gold")],
                ext_card_share_start=1.0, ext_card_share_end=1.0,
                balances={self.primary: 22300.0, "santander": 1100.0}, balance_noise=0.06,
                loans=[LoanPlan("santander", "rotativo_cartao", 11200.0, 13.8, None),
                       LoanPlan("santander", "cheque_especial", 7300.0, 7.9, None)],
            )

        def carla() -> Profile:
            # Churn risk: salary moved to Itaú, balance drained and investments transferred to XP.
            return Profile(
                customer_id="CUS-00004", name="Carla Mendes", age_range="35-44", occupation="Assalariado CLT",
                state="PR", income=12800.0, income_vol=0.02, thirteenth=True,
                relationship_since=dt.date(2016, 2, 11), salary_institution=self.primary,
                salary_move_to="itau", salary_move_idx=n - 2,
                expense_ratio=0.64, card_share=0.5, spending_surge=1.12,
                cards=[CardPlan(self.primary, 1.0, 20000, "Visa", "Platinum"),
                       CardPlan("itau", 1.0, 18000, "Visa", "Platinum")],
                ext_card_share_start=0.18, ext_card_share_end=0.66,
                balances={self.primary: 19500.0, "itau": 2600.0}, balance_noise=0.05, primary_drain=0.42,
                investments=[InvestmentPlan(self.primary, "cdb", "CDB 110% CDI 2028", 11800.0),
                             InvestmentPlan(self.primary, "previdencia", "VGBL Moderado", 23000.0)],
                invest_outflow=0.6, invest_outflow_to="xp",
            )

        def rafael() -> Profile:
            # Credit portability: payroll loan and car financing at competitors above our reference.
            return Profile(
                customer_id="CUS-00005", name="Rafael Costa", age_range="45-54", occupation="Servidor público",
                state="DF", income=11400.0, income_vol=0.01, thirteenth=True,
                relationship_since=dt.date(2011, 8, 30), salary_institution=self.primary,
                expense_ratio=0.55, card_share=0.45,
                cards=[CardPlan(self.primary, 1.0, 16000, "Visa", "Platinum")],
                balances={self.primary: 9400.0, "bradesco": 800.0, "santander": 500.0},
                investments=[InvestmentPlan(self.primary, "lci_lca", "LCI 92% CDI 2027", 21000.0)],
                loans=[LoanPlan("bradesco", "consignado", 62000.0, 2.05, 58),
                       LoanPlan("santander", "veiculo", 38500.0, 2.2, 30)],
            )

        return [joao, maria, lucas, carla, rafael]

    # -- materialization -------------------------------------------------------------------

    def _materialize(self, p: Profile) -> None:  # noqa: C901 - linear, step-by-step build
        rng = self.rng
        M = self.n_months
        t_idx = np.arange(M)
        months = self.months
        primary = self.primary
        cid = p.customer_id

        # 1) Relationship set and accounts ---------------------------------------------
        insts: list[str] = []

        def add(inst: str | None) -> None:
            if inst and inst not in insts and inst not in p.revoked:
                insts.append(inst)

        add(primary)
        add(p.salary_institution)
        add(p.salary_move_to)
        for card in p.cards:
            add(card.institution_id)
        for inv in p.investments:
            add(inv.institution_id)
        for loan in p.loans:
            add(loan.institution_id)
        add(p.invest_outflow_to)
        for inst in p.balances:
            add(inst)
        for inst, _t, _v in p.extra_accounts:
            add(inst)

        main_account: dict[str, str] = {}
        account_rows: list[dict] = []
        account_series: dict[str, np.ndarray] = {}
        account_inst: dict[str, str] = {}

        def open_account(inst: str, acc_type: str, target: float) -> str:
            acc_id = self._id("ACC")
            if inst == primary:
                opened = p.relationship_since
            else:
                opened = self.reference_date - dt.timedelta(days=int(rng.integers(200, 3200)))
            series = np.maximum(target * (1 + rng.normal(0, p.balance_noise, M)), 0.0)
            account_series[acc_id] = series
            account_inst[acc_id] = inst
            account_rows.append({"account_id": acc_id, "customer_id": cid, "institution_id": inst,
                                 "account_type": acc_type, "opened_at": opened})
            return acc_id

        reasons = {primary, p.salary_institution, p.salary_move_to, p.invest_outflow_to, *p.balances,
                   *(c.institution_id for c in p.cards), *(i.institution_id for i in p.investments),
                   *(ln.institution_id for ln in p.loans)}
        for inst in insts:
            if inst not in reasons:  # only a savings account at this institution
                continue
            category = ref.INSTITUTION_BY_ID[inst]["category"]
            target = p.balances.get(inst, self._u(150, 1800))
            main_account[inst] = open_account(inst, MAIN_ACCOUNT_TYPE[category], target)
        for inst, acc_type, target in p.extra_accounts:
            if inst in insts:
                main_account.setdefault(inst, open_account(inst, acc_type, target))

        # 2) Income --------------------------------------------------------------------
        income_t = p.income * (1 + rng.normal(0, p.income_vol, M))
        if p.thirteenth:
            for t, month in enumerate(months):
                if month.month in (11, 12):
                    income_t[t] += 0.5 * p.income
        income_t = np.maximum(income_t, 0.35 * p.income)
        salary_inst_t = [p.salary_institution] * M
        if p.salary_move_to and p.salary_move_idx is not None:
            for t in range(p.salary_move_idx, M):
                salary_inst_t[t] = p.salary_move_to

        # 3) Expenses and card spend -----------------------------------------------------
        season = np.array([SEASONALITY.get(m.month, 1.0) for m in months])
        expenses_t = p.income * p.expense_ratio * season * rng.normal(1, 0.05, M)
        if p.spending_surge > 1:
            expenses_t[-3:] *= p.spending_surge
        card_total_t = expenses_t * p.card_share if p.cards else np.zeros(M)
        cash_expenses_t = expenses_t - card_total_t

        primary_cards = [i for i, c in enumerate(p.cards) if c.institution_id == primary and primary not in p.revoked]
        external_cards = [i for i, c in enumerate(p.cards) if c.institution_id != primary and c.institution_id in insts]
        ext_share_t = np.where(t_idx < M - 3, p.ext_card_share_start, p.ext_card_share_end) + rng.normal(0, 0.015, M)
        if not primary_cards:
            ext_share_t[:] = 1.0
        if not external_cards:
            ext_share_t[:] = 0.0
        ext_share_t = np.clip(ext_share_t, 0, 1)
        card_spend: dict[int, np.ndarray] = {}
        for group, share in ((primary_cards, 1 - ext_share_t), (external_cards, ext_share_t)):
            total_w = sum(p.cards[i].weight for i in group) or 1.0
            for i in group:
                card_spend[i] = card_total_t * share * p.cards[i].weight / total_w

        # 4) Balances: drain / salary move ------------------------------------------------
        prim_acc = main_account[primary]
        if p.primary_drain < 1.0:
            d = p.primary_drain
            base = account_series[prim_acc][: M - 3].mean()
            path = np.array([1 - (1 - d) * 0.35, 1 - (1 - d) * 0.7, d])
            account_series[prim_acc][M - 3:] = base * path * (1 + rng.normal(0, 0.02, 3))
            receiver = p.salary_move_to or p.invest_outflow_to or next((i for i in insts if i != primary), None)
            if receiver and receiver in main_account:
                account_series[main_account[receiver]][M - 3:] += base * (1 - path) * 0.6
        if p.salary_move_to and p.salary_move_idx is not None and p.salary_move_to in main_account:
            k = p.salary_move_idx
            new_acc = main_account[p.salary_move_to]
            account_series[new_acc][k:] += p.income * 0.35 * (t_idx[k:] - k + 1)

        # 5) Investments -------------------------------------------------------------------
        investments = [inv for inv in p.investments if inv.institution_id in insts]
        inv_series: list[np.ndarray] = []
        for inv in investments:
            growth = ref.INVESTMENT_TYPES[inv.investment_type]["yield"] + (0.0 if p.stressed else self._u(0.0, 0.012))
            inv_series.append(inv.balance / (1 + growth) ** (M - 1 - t_idx))
        if p.invest_outflow > 0 and p.invest_outflow_to in insts:
            k = M - 2
            moved = 0.0
            for j, inv in enumerate(investments):
                if inv.institution_id == primary:
                    before = inv_series[j] / (1 - p.invest_outflow)
                    moved += float(before[k - 1] - inv_series[j][k - 1])
                    inv_series[j][:k] = before[:k]
            receivers = [j for j, inv in enumerate(investments) if inv.institution_id == p.invest_outflow_to]
            if receivers:
                j = receivers[0]
                investments[j].balance += moved
                inv_series[j] = inv_series[j] + np.where(t_idx >= k, moved, 0.0)
            else:
                kind = self._pick({"cdb": 0.4, "tesouro": 0.3, "multimercado": 0.3})
                investments.append(self._investment(p.invest_outflow_to, kind, moved))
                inv_series.append(np.where(t_idx >= k, moved * (1.009 ** (t_idx - k)), 0.0))

        # 6) Loans -------------------------------------------------------------------------
        loans = [ln for ln in p.loans if ln.institution_id in insts]
        loan_series: list[np.ndarray] = []
        installments: list[float] = []
        for ln in loans:
            r = ln.rate / 100
            if ln.remaining_months is None:  # revolving: interest + small amortization
                installment = ln.balance * (r + 0.04)
                trend = np.linspace(0.75, 1.0, M) if p.stressed else np.ones(M)
                series = ln.balance * trend * (1 + rng.normal(0, 0.06, M))
                series[-1] = ln.balance
            else:
                installment = pmt(ln.rate, ln.remaining_months, ln.balance)
                principal = max(installment - ln.balance * r, installment * 0.1)
                series = ln.balance + principal * (M - 1 - t_idx)
            series = np.where(t_idx >= ln.start_idx, series, 0.0)
            loan_series.append(series)
            installments.append(installment)

        # 7) Snapshots -----------------------------------------------------------------------
        for inst in insts:
            acc_bal = sum((s for a, s in account_series.items() if account_inst[a] == inst), np.zeros(M))
            inv_bal = sum((s for j, s in enumerate(inv_series) if investments[j].institution_id == inst), np.zeros(M))
            loan_bal = sum((s for j, s in enumerate(loan_series) if loans[j].institution_id == inst), np.zeros(M))
            bill = sum((card_spend[i] for i in card_spend if p.cards[i].institution_id == inst), np.zeros(M))
            for t in range(M):
                self._snapshots.append((cid, inst, months[t], round(float(acc_bal[t]), 2), round(float(inv_bal[t]), 2),
                                        round(float(loan_bal[t]), 2), round(float(bill[t]), 2)))

        # 8) Transactions --------------------------------------------------------------------
        tx = self._transactions
        card_ids = {i: self._id("CRD") for i in card_spend}
        loan_ids = [self._id("LOA") for _ in loans]
        cat_names = list(ref.CARD_SPEND_CATEGORIES)
        cat_weights = np.array(list(ref.CARD_SPEND_CATEGORIES.values()))
        cat_weights = cat_weights / cat_weights.sum()
        occupation = p.occupation

        for t, month in enumerate(months):
            sal_inst = salary_inst_t[t]
            sal_acc = main_account.get(sal_inst, prim_acc)

            def day(lo: int = 1, hi: int = 28, _m: dt.date = month) -> dt.date:
                return _m.replace(day=int(rng.integers(lo, hi + 1)))

            # income
            inc = float(income_t[t])
            if occupation in ("Assalariado CLT", "Servidor público"):
                tx.append((cid, sal_inst, sal_acc, None, day(4, 6), round(inc, 2), "salario", "credito", "Crédito de salário"))
            elif occupation == "Aposentado":
                tx.append((cid, sal_inst, sal_acc, None, day(1, 5), round(inc, 2), "salario", "credito", "Benefício de aposentadoria"))
            elif occupation == "Empresário":
                pro_labore = inc * 0.6
                tx.append((cid, sal_inst, sal_acc, None, day(4, 7), round(pro_labore, 2), "salario", "credito", "Pró-labore"))
                tx.append((cid, sal_inst, sal_acc, None, day(15, 25), round(inc - pro_labore, 2), "renda_extra", "credito", "Distribuição de lucros"))
            else:
                parts = rng.dirichlet(np.ones(2) * 3)
                for part in parts:
                    tx.append((cid, sal_inst, sal_acc, None, day(), round(inc * float(part), 2), "transferencia_recebida", "credito", "PIX recebido"))

            # card purchases
            for i, spend in card_spend.items():
                amount = float(spend[t])
                if amount < 1:
                    continue
                card_inst = p.cards[i].institution_id
                n = 1 + int(amount > 900) + int(amount > 2800)
                split = rng.dirichlet(np.ones(n) * 2) if n > 1 else [1.0]
                for part in split:
                    cat = cat_names[int(rng.choice(len(cat_names), p=cat_weights))]
                    tx.append((cid, card_inst, None, card_ids[i], day(), round(-amount * float(part), 2), cat, "cartao",
                               f"Compra no cartão · {ref.TRANSACTION_CATEGORY_LABELS[cat]}"))

            # account expenses (bills, PIX, debit purchases)
            cash = float(cash_expenses_t[t])
            spend_acc = sal_acc
            spend_inst = sal_inst
            bills = cash * self._u(0.38, 0.52)
            pix = (cash - bills) * self._u(0.45, 0.65)
            debit = cash - bills - pix
            tx.append((cid, spend_inst, spend_acc, None, day(8, 12), round(-bills, 2), "contas_boletos", "debito", "Pagamento de contas"))
            if sal_inst != primary and rng.random() < 0.6:
                tx.append((cid, primary, prim_acc, None, day(), round(-pix, 2), "pix_enviado", "debito", "PIX enviado"))
            else:
                tx.append((cid, spend_inst, spend_acc, None, day(), round(-pix, 2), "pix_enviado", "debito", "PIX enviado"))
            if debit > 50:
                tx.append((cid, spend_inst, spend_acc, None, day(), round(-debit, 2), "compra_debito", "debito", "Compra no débito"))

            # loans
            for j, ln in enumerate(loans):
                if t < ln.start_idx:
                    continue
                acc = main_account.get(ln.institution_id, sal_acc)
                label = ref.LOAN_TYPES[ln.loan_type]["label"]
                if t == ln.start_idx and ln.start_idx > 0:
                    tx.append((cid, ln.institution_id, acc, None, day(1, 10), round(float(loan_series[j][t]), 2),
                               "liberacao_credito", "credito", f"Liberação · {label}"))
                    continue
                desc = f"Encargos · {label}" if ln.remaining_months is None else f"Parcela · {label}"
                tx.append((cid, ln.institution_id, acc, None, day(14, 16), round(-installments[j], 2), "parcela_emprestimo", "debito", desc))

            # investments: applications and redemptions implied by the position series
            if t > 0:
                for j, inv in enumerate(investments):
                    yld = ref.INVESTMENT_TYPES[inv.investment_type]["yield"]
                    diff = float(inv_series[j][t] - inv_series[j][t - 1] * (1 + yld))
                    if abs(diff) < 30:
                        continue
                    acc = main_account.get(inv.institution_id, sal_acc)
                    if diff > 0:
                        tx.append((cid, inv.institution_id, acc, None, day(5, 25), round(-diff, 2), "aplicacao_investimento", "debito", f"Aplicação · {inv.product_name}"))
                    else:
                        tx.append((cid, inv.institution_id, acc, None, day(5, 25), round(-diff, 2), "resgate_investimento", "credito", f"Resgate · {inv.product_name}"))

        # 9) Entities with current positions ------------------------------------------------
        for row in account_rows:
            series = account_series[row["account_id"]]
            row["balance"] = round(float(series[-1]) * self._u(0.96, 1.04), 2)
            row["average_balance"] = round(float(series[-6:].mean()), 2)
            self._accounts.append(row)
        for i, card_id in card_ids.items():
            plan = p.cards[i]
            bill = round(float(card_spend[i][-1]), 2)
            util = bill / plan.limit if plan.limit else 0.0
            if p.stressed:
                util = max(util, self._u(0.82, 0.99))
                bill = round(plan.limit * util, 2)
            self._cards.append({"card_id": card_id, "customer_id": cid, "institution_id": plan.institution_id,
                                "brand": plan.brand, "tier": plan.tier, "credit_limit": plan.limit,
                                "monthly_bill": bill, "utilization": round(min(util, 1.0), 4)})
        for j, inv in enumerate(investments):
            meta = ref.INVESTMENT_TYPES[inv.investment_type]
            self._investments.append({"investment_id": self._id("INV"), "customer_id": cid, "institution_id": inv.institution_id,
                                      "investment_type": inv.investment_type, "product_name": inv.product_name,
                                      "balance": round(float(inv_series[j][-1]), 2), "risk_category": meta["risk"],
                                      "liquidity": meta["liquidity"]})
        for j, ln in enumerate(loans):
            self._loans.append({"loan_id": loan_ids[j], "customer_id": cid, "institution_id": ln.institution_id,
                                "loan_type": ln.loan_type, "balance": round(float(loan_series[j][-1]), 2),
                                "interest_rate": ln.rate, "installment": round(installments[j], 2),
                                "remaining_months": ln.remaining_months})

        # 10) Consents (external institutions only — the primary bank's own data needs none) --
        scopes_by_inst: dict[str, set[str]] = defaultdict(lambda: {"contas", "transacoes"})
        for card in p.cards:
            scopes_by_inst[card.institution_id].add("cartoes_credito")
        for inv in investments:
            scopes_by_inst[inv.institution_id].add("investimentos")
        for ln in loans:
            scopes_by_inst[ln.institution_id].add("operacoes_credito")
        for inst in [*insts, *p.revoked]:
            if inst == primary:
                continue
            granted = self.reference_dt - dt.timedelta(days=int(rng.integers(25, 345)), hours=int(rng.integers(0, 12)))
            expires = granted + dt.timedelta(days=365)
            if inst in p.revoked:
                status, last_sync = "revoked", granted + dt.timedelta(days=int(rng.integers(10, 60)))
            else:
                status = "expiring" if (expires - self.reference_dt).days <= 30 else "active"
                last_sync = self.reference_dt - dt.timedelta(hours=int(rng.integers(1, 60)), minutes=int(rng.integers(0, 60)))
            self._consents.append({"consent_id": self._id("CNS", 7), "customer_id": cid, "institution_id": inst,
                                   "status": status, "scopes": sorted(scopes_by_inst[inst]), "purpose": ref.CONSENT_PURPOSE,
                                   "granted_at": granted, "expires_at": expires, "last_sync_at": last_sync})

        # 11) Customer --------------------------------------------------------------------------
        total_assets = sum(float(s[-1]) for s in account_series.values()) + sum(float(s[-1]) for s in inv_series)
        if total_assets >= 1_000_000 or p.income >= 35000:
            segment = "Private"
        elif total_assets >= 150_000 or p.income >= 10000:
            segment = "Alta Renda"
        else:
            segment = "Varejo"
        self._customers.append({
            "customer_id": cid, "name": p.name, "age_range": p.age_range, "income": p.income,
            "occupation_category": p.occupation, "relationship_since": p.relationship_since,
            "primary_bank": salary_inst_t[-1], "segment": segment, "state": p.state,
            "created_at": dt.datetime.combine(p.relationship_since, dt.time(10, 0)),
        })

    # -- output ----------------------------------------------------------------------------------

    def _to_dataset(self) -> GeneratedDataset:
        transactions = pd.DataFrame(
            self._transactions,
            columns=["customer_id", "institution_id", "account_id", "card_id", "date", "amount",
                     "category", "transaction_type", "description"],
        )
        transactions = transactions.sort_values(["customer_id", "date"], kind="stable").reset_index(drop=True)
        transactions.insert(0, "transaction_id", np.arange(1, len(transactions) + 1))
        snapshots = pd.DataFrame(
            self._snapshots,
            columns=["customer_id", "institution_id", "month", "account_balance", "investment_balance",
                     "loan_balance", "card_bill"],
        )
        snapshots.insert(0, "id", np.arange(1, len(snapshots) + 1))
        return GeneratedDataset(
            institutions=pd.DataFrame(ref.INSTITUTIONS),
            customers=pd.DataFrame(self._customers),
            accounts=pd.DataFrame(self._accounts),
            credit_cards=pd.DataFrame(self._cards),
            investments=pd.DataFrame(self._investments),
            loans=pd.DataFrame(self._loans),
            transactions=transactions,
            balance_snapshots=snapshots,
            consents=pd.DataFrame(self._consents),
            months=self.months,
            reference_date=self.reference_date,
        )
