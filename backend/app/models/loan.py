from __future__ import annotations

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, Money, Rate


class Loan(Base):
    __tablename__ = "loans"

    loan_id: Mapped[str] = mapped_column(String(16), primary_key=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.customer_id"), index=True)
    institution_id: Mapped[str] = mapped_column(ForeignKey("institutions.institution_id"), index=True)
    loan_type: Mapped[str] = mapped_column(String(32))
    balance: Mapped[float] = mapped_column(Money)
    interest_rate: Mapped[float] = mapped_column(Rate)  # % per month
    installment: Mapped[float] = mapped_column(Money)
    remaining_months: Mapped[int | None] = mapped_column(Integer, nullable=True)  # None = revolving credit
