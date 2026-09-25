from __future__ import annotations

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Institution(Base):
    """A financial institution participating in Open Finance (bank, digital bank, broker, fintech)."""

    __tablename__ = "institutions"

    institution_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    short_name: Mapped[str] = mapped_column(String(24))
    category: Mapped[str] = mapped_column(String(32))
    brand_color: Mapped[str] = mapped_column(String(9))
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
