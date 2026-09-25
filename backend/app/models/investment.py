from __future__ import annotations

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, Money


class Investment(Base):
    __tablename__ = "investments"

    investment_id: Mapped[str] = mapped_column(String(16), primary_key=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.customer_id"), index=True)
    institution_id: Mapped[str] = mapped_column(ForeignKey("institutions.institution_id"), index=True)
    investment_type: Mapped[str] = mapped_column(String(32))
    product_name: Mapped[str] = mapped_column(String(80))
    balance: Mapped[float] = mapped_column(Money)
    risk_category: Mapped[str] = mapped_column(String(12))
    liquidity: Mapped[str] = mapped_column(String(16))
