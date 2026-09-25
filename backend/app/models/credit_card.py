from __future__ import annotations

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, Money, Rate


class CreditCard(Base):
    __tablename__ = "credit_cards"

    card_id: Mapped[str] = mapped_column(String(16), primary_key=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.customer_id"), index=True)
    institution_id: Mapped[str] = mapped_column(ForeignKey("institutions.institution_id"), index=True)
    brand: Mapped[str] = mapped_column(String(16))
    tier: Mapped[str] = mapped_column(String(16))
    credit_limit: Mapped[float] = mapped_column(Money)
    monthly_bill: Mapped[float] = mapped_column(Money)  # last closed bill
    utilization: Mapped[float] = mapped_column(Rate)  # monthly_bill / credit_limit
