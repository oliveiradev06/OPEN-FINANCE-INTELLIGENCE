"""Analytics: segmentation (KMeans), distributions, wallet-share trends and anomalies."""

from __future__ import annotations

import random
from collections import Counter, defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.routes.meta import latest_run
from app.core.database import get_db
from app.core.security import require
from app.data import reference as ref
from app.ml.segmentation import FEATURES
from app.models import Customer, CustomerMetrics, CustomerMonthlyMetric, Opportunity, Segment

router = APIRouter(prefix="/api/analytics", tags=["analytics"], dependencies=[Depends(require("portfolio:read"))])


def _histogram(values: list[float], width: int = 10) -> list[dict]:
    counts = Counter(min(int(v // width) * width, 100 - width) for v in values)
    return [{"bin": f"{b}–{b + width}", "from": b, "count": counts.get(b, 0)} for b in range(0, 100, width)]


@router.get("/overview")
def overview(db: Session = Depends(get_db)) -> dict:
    cm = CustomerMetrics
    rows = db.execute(select(cm.customer_id, cm.health_score, cm.health_band, cm.opportunity_score, cm.segment_id,
                             cm.monthly_income, cm.external_asset_share, cm.total_assets, cm.card_external_share,
                             cm.debt_service_ratio, cm.is_anomaly, cm.anomaly_score)).all()
    names = dict(db.execute(select(Customer.customer_id, Customer.name)).all())
    segments = db.scalars(select(Segment).order_by(Segment.segment_id)).all()

    type_by_segment: dict[int, Counter] = defaultdict(Counter)
    seg_of = {r.customer_id: r.segment_id for r in rows}
    for cid, kind in db.execute(select(Opportunity.customer_id, Opportunity.type)):
        type_by_segment[seg_of.get(cid)][kind] += 1

    rng = random.Random(7)
    sample = rng.sample(rows, k=min(900, len(rows)))
    mm = CustomerMonthlyMetric
    trend = db.execute(
        select(mm.month, func.sum(mm.balance_primary), func.sum(mm.balance_external), func.sum(mm.investments_primary),
               func.sum(mm.investments_external), func.sum(mm.card_spend_primary), func.sum(mm.card_spend_external),
               func.sum(mm.income), func.sum(mm.expenses))
        .group_by(mm.month).order_by(mm.month)
    ).all()
    run = latest_run(db)
    anomalies = sorted((r for r in rows if r.is_anomaly), key=lambda r: -r.anomaly_score)
    reasons = dict(db.execute(select(cm.customer_id, cm.anomaly_reasons).where(cm.is_anomaly.is_(True))).all())

    def share(a, b) -> float:
        a, b = float(a or 0), float(b or 0)
        return round(a / (a + b), 4) if a + b else 0.0

    return {
        "segments": [{
            "segment_id": s.segment_id, "name": s.name, "description": s.description, "size": s.size,
            "profile": s.profile,
            "opportunities": [{"type": k, "label": ref.OPPORTUNITY_TYPES[k]["label"], "count": n}
                              for k, n in type_by_segment[s.segment_id].most_common()],
        } for s in segments],
        "model": {
            "algorithm": "KMeans", "k": len(segments), "features": FEATURES,
            "silhouette": (run.stats or {}).get("silhouette") if run else None,
            "anomaly_algorithm": "Isolation Forest", "anomalies": len(anomalies),
            "timings": (run.stats or {}).get("timings") if run else None,
        },
        "health_histogram": _histogram([r.health_score for r in rows]),
        "score_histogram": _histogram([r.opportunity_score for r in rows if r.opportunity_score > 0]),
        "band_counts": dict(Counter(r.health_band for r in rows)),
        "scatter": [{
            "customer_id": r.customer_id, "name": names.get(r.customer_id, ""), "segment_id": r.segment_id,
            "income": r.monthly_income, "external_asset_share": r.external_asset_share,
            "card_external_share": r.card_external_share, "assets": r.total_assets, "health_score": r.health_score,
            "debt_service_ratio": r.debt_service_ratio,
        } for r in sample],
        "trend": [{
            "month": t[0], "balances_primary_share": share(t[1], t[2]), "investments_primary_share": share(t[3], t[4]),
            "card_primary_share": share(t[5], t[6]), "income": float(t[7] or 0), "expenses": float(t[8] or 0),
        } for t in trend],
        "anomalies": [{
            "customer_id": r.customer_id, "name": names.get(r.customer_id, ""), "score": r.anomaly_score,
            "reasons": reasons.get(r.customer_id) or [], "health_score": r.health_score,
        } for r in anomalies[:12]],
    }
