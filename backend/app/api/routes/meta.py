from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import __version__
from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import PERMISSION_LABELS, ROLES, Analyst, current_analyst
from app.data import reference as ref
from app.models import CustomerMetrics, CustomerMonthlyMetric, EngineRun, Segment
from app.services.ai_insights import ai_status
from app.services.behavior_analysis import SIGNAL_TYPES
from app.services.financial_health import BANDS
from app.services.opportunity_engine.rules import CDI_MONTHLY_YIELD
from app.services.serializers import institution_ref


def simulation_assumptions() -> dict:
    """The same reference numbers the engine uses, so a simulation never contradicts an opportunity."""
    return {
        "cdi_monthly": CDI_MONTHLY_YIELD,
        "expensive_debt_rate": ref.EXPENSIVE_DEBT_RATE,
        "reference_rates": [{"loan_type": k, "label": ref.LOAN_TYPES[k]["label"], "rate": v}
                            for k, v in ref.PRIMARY_REFERENCE_RATES.items()],
        "investment_products": [{"type": k, "label": v["label"], "monthly_yield": v["yield"], "liquidity": v["liquidity"],
                                 "risk": v["risk"]} for k, v in ref.INVESTMENT_TYPES.items()],
    }

router = APIRouter(prefix="/api", tags=["meta"])


def latest_run(db: Session) -> EngineRun | None:
    return db.scalars(select(EngineRun).order_by(EngineRun.started_at.desc()).limit(1)).first()


def run_ref(run: EngineRun | None) -> dict | None:
    if run is None:
        return None
    return {"run_id": run.run_id, "finished_at": run.finished_at, "duration_ms": run.duration_ms,
            "trigger": run.trigger, "engine_version": run.engine_version}


@router.get("/health")
def health(db: Session = Depends(get_db)) -> dict:
    customers = db.scalar(select(func.count()).select_from(CustomerMetrics)) or 0
    return {"status": "ok", "database": "sqlite" if get_settings().is_sqlite else "postgresql", "customers": customers}


@router.get("/meta")
def meta(db: Session = Depends(get_db), analyst: Analyst = Depends(current_analyst)) -> dict:
    """Vocabulary, labels and context the UI needs once (institutions, types, roles...)."""
    segments = db.scalars(select(Segment).order_by(Segment.segment_id)).all()
    reference_month = db.scalar(select(func.max(CustomerMonthlyMetric.month)))
    return {
        "app": {"name": "Open Finance Intelligence", "version": __version__, "environment": get_settings().environment,
                "synthetic_data": True},
        "primary_institution": institution_ref(ref.PRIMARY_INSTITUTION_ID),
        "institutions": [institution_ref(i["institution_id"]) for i in ref.INSTITUTIONS],
        "institution_categories": ref.INSTITUTION_CATEGORY_LABELS,
        "opportunity_types": [{"key": k, "label": v["label"], "title": v["title"]} for k, v in ref.OPPORTUNITY_TYPES.items()],
        "opportunity_statuses": [{"key": k, "label": v} for k, v in ref.OPPORTUNITY_STATUSES.items()],
        "signal_types": [{"key": k, "label": v} for k, v in SIGNAL_TYPES.items()],
        "health_bands": [{"key": code, "label": label, "min": threshold} for threshold, code, label in BANDS],
        "segments": [{"segment_id": s.segment_id, "name": s.name, "description": s.description, "size": s.size} for s in segments],
        "reference_month": reference_month,
        "last_run": run_ref(latest_run(db)),
        "analyst": {"id": analyst.id, "name": analyst.name, "role": analyst.role, "role_label": analyst.role_label,
                    "permissions": analyst.permissions},
        "roles": [{"key": k, "label": v["label"], "description": v["description"], "permissions": v["permissions"]}
                  for k, v in ROLES.items()],
        "permission_labels": PERMISSION_LABELS,
        "ai": ai_status(),
        "simulation": simulation_assumptions(),
    }
