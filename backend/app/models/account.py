from __future__ import annotations

import datetime as dt

from sqlalchemy import Date, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, Money


class Account(Base):
    __tablename__ = "accounts"

    account_id: Mapped[str] = mapped_column(String(16), primary_key=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.customer_id"), index=True)
    institution_id: Mapped[str] = mapped_column(ForeignKey("institutions.institution_id"), index=True)
    account_type: Mapped[str] = mapped_column(String(24))
    balance: Mapped[float] = mapped_column(Money)
    average_balance: Mapped[float] = mapped_column(Money)  # average month-end balance, last 6 months
    opened_at: Mapped[dt.date] = mapped_column(Date)
