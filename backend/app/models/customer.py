from __future__ import annotations

import datetime as dt

from sqlalchemy import Date, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, Money


class Customer(Base):
    """Customer of the primary bank who authorized Open Finance data sharing.

    Data minimization (LGPD): no CPF, address, phone or e-mail is stored — the analysis
    only needs an internal identifier and coarse demographic bands.
    """

    __tablename__ = "customers"

    customer_id: Mapped[str] = mapped_column(String(16), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    age_range: Mapped[str] = mapped_column(String(8))
    income: Mapped[float] = mapped_column(Money)
    occupation_category: Mapped[str] = mapped_column(String(40))
    relationship_since: Mapped[dt.date] = mapped_column(Date)
    # Institution where the customer's income (salary) is credited.
    primary_bank: Mapped[str] = mapped_column(ForeignKey("institutions.institution_id"))
    segment: Mapped[str] = mapped_column(String(20))
    state: Mapped[str] = mapped_column(String(2))
    created_at: Mapped[dt.datetime] = mapped_column(DateTime)
