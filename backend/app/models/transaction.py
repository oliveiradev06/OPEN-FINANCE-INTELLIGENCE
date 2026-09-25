from __future__ import annotations

import datetime as dt

from sqlalchemy import BigInteger, Date, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, Money


class Transaction(Base):
    """Raw Open Finance transaction.

    ``amount`` is signed: positive for credits, negative for debits.
    ``transaction_type`` is one of ``credito`` | ``debito`` | ``cartao`` (credit card purchase).
    """

    __tablename__ = "transactions"

    transaction_id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True
    )
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.customer_id"))
    institution_id: Mapped[str] = mapped_column(ForeignKey("institutions.institution_id"))
    account_id: Mapped[str | None] = mapped_column(ForeignKey("accounts.account_id"), nullable=True)
    card_id: Mapped[str | None] = mapped_column(ForeignKey("credit_cards.card_id"), nullable=True)
    date: Mapped[dt.date] = mapped_column(Date)
    amount: Mapped[float] = mapped_column(Money)
    category: Mapped[str] = mapped_column(String(32))
    transaction_type: Mapped[str] = mapped_column(String(8))
    description: Mapped[str] = mapped_column(String(80))

    __table_args__ = (
        Index("ix_transactions_customer_date", "customer_id", "date"),
        Index("ix_transactions_customer_institution", "customer_id", "institution_id"),
    )
