import datetime as dt

from app.data.generator import SyntheticDataGenerator


def _dataset(seed: int = 7):
    return SyntheticDataGenerator(n_customers=120, seed=seed, reference_date=dt.date(2026, 9, 24)).generate()


def test_twelve_closed_months_ending_before_reference_date():
    ds = _dataset()
    assert len(ds.months) == 12
    assert ds.months[-1] == dt.date(2026, 8, 1)
    assert ds.months[0] == dt.date(2025, 9, 1)


def test_generation_is_reproducible():
    a, b = _dataset(seed=11), _dataset(seed=11)
    assert a.counts() == b.counts()
    assert a.transactions["amount"].sum() == b.transactions["amount"].sum()


def test_transaction_signs_follow_type():
    tx = _dataset().transactions
    assert (tx.loc[tx["transaction_type"] == "credito", "amount"] > 0).all()
    assert (tx.loc[tx["transaction_type"].isin(["debito", "cartao"]), "amount"] < 0).all()
    assert tx.loc[tx["transaction_type"] == "cartao", "card_id"].notna().all()


def test_referential_integrity():
    ds = _dataset()
    customers = set(ds.customers["customer_id"])
    for frame in (ds.accounts, ds.credit_cards, ds.investments, ds.loans, ds.transactions, ds.consents):
        assert set(frame["customer_id"]) <= customers
    accounts = set(ds.accounts["account_id"])
    assert set(ds.transactions["account_id"].dropna()) <= accounts


def test_primary_bank_data_needs_no_consent():
    consents = _dataset().consents
    assert "aurora" not in set(consents["institution_id"])
    assert set(consents["status"]) <= {"active", "expiring", "revoked"}


def test_demo_personas_are_present():
    names = _dataset().customers.set_index("customer_id")["name"]
    assert names["CUS-00001"] == "João Silva"
    assert names["CUS-00002"] == "Maria Souza"
