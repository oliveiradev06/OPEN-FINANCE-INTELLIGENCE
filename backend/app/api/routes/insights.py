from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require
from app.models import PortfolioInsight
from app.schemas import InsightOut

router = APIRouter(prefix="/api/insights", tags=["insights"], dependencies=[Depends(require("portfolio:read"))])


@router.get("", response_model=list[InsightOut])
def list_insights(db: Session = Depends(get_db)) -> list[PortfolioInsight]:
    """Portfolio insights generated automatically by the last engine run."""
    return list(db.scalars(select(PortfolioInsight).order_by(PortfolioInsight.rank)))
