"""Governance & LGPD: engine rules, consents, access control, audit trail and engine runs."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import PERMISSION_LABELS, ROLES, Analyst, current_analyst, require
from app.data import reference as ref
from app.models import AuditLog, Consent, EngineRun
from app.pipeline.runner import PipelineBusyError, run_pipeline
from app.services.ai_insights import ai_status
from app.services.behavior_analysis import SIGNAL_TYPES, THRESHOLDS
from app.services.financial_health import COMPONENTS
from app.services.opportunity_engine import ENGINE_VERSION, MIN_SCORE, OpportunityEngine

router = APIRouter(prefix="/api", tags=["governance"])


def _run_out(run: EngineRun) -> dict:
    return {
        "run_id": run.run_id, "started_at": run.started_at, "finished_at": run.finished_at,
        "duration_ms": run.duration_ms, "status": run.status, "trigger": run.trigger,
        "engine_version": run.engine_version, "customers_processed": run.customers_processed,
        "opportunities_created": run.opportunities_created, "signals_created": run.signals_created,
        "stats": run.stats,
    }


@router.get("/governance/engine", dependencies=[Depends(require("portfolio:read"))])
def engine_config(db: Session = Depends(get_db)) -> dict:
    runs = db.scalars(select(EngineRun).order_by(EngineRun.started_at.desc()).limit(10)).all()
    return {
        "version": ENGINE_VERSION,
        "min_score": MIN_SCORE,
        "priority_thresholds": {"high": 80, "medium": 60},
        "rules": OpportunityEngine().describe(),
        "health_components": COMPONENTS,
        "signal_thresholds": THRESHOLDS,
        "signal_types": SIGNAL_TYPES,
        "runs": [_run_out(r) for r in runs],
        "ai": ai_status(),
    }


@router.get("/governance/consents", dependencies=[Depends(require("portfolio:read"))])
def consents(db: Session = Depends(get_db)) -> dict:
    by_status = dict(db.execute(select(Consent.status, func.count()).group_by(Consent.status)).all())
    by_inst = db.execute(
        select(Consent.institution_id, Consent.status, func.count()).group_by(Consent.institution_id, Consent.status)
    ).all()
    per_inst: dict[str, dict] = {}
    for inst, status, n in by_inst:
        per_inst.setdefault(inst, {"institution_id": inst, "short_name": ref.INSTITUTION_BY_ID[inst]["short_name"],
                                   "brand_color": ref.INSTITUTION_BY_ID[inst]["brand_color"],
                                   "active": 0, "expiring": 0, "revoked": 0})[status] = n
    scopes = db.scalars(select(Consent.scopes).where(Consent.status != "revoked")).all()
    scope_counts: dict[str, int] = {}
    for scope_list in scopes:
        for s in scope_list:
            scope_counts[s] = scope_counts.get(s, 0) + 1
    return {
        "total": sum(by_status.values()),
        "active": by_status.get("active", 0), "expiring": by_status.get("expiring", 0), "revoked": by_status.get("revoked", 0),
        "by_institution": sorted(per_inst.values(), key=lambda r: -(r["active"] + r["expiring"])),
        "scopes": dict(sorted(scope_counts.items(), key=lambda kv: -kv[1])),
        "purpose": ref.CONSENT_PURPOSE,
    }


@router.get("/governance/access")
def access(analyst: Analyst = Depends(current_analyst)) -> dict:
    return {
        "current": {"id": analyst.id, "name": analyst.name, "role": analyst.role, "role_label": analyst.role_label,
                    "permissions": analyst.permissions},
        "roles": [{"key": k, **v} for k, v in ROLES.items()],
        "permissions": PERMISSION_LABELS,
    }


@router.get("/governance/audit-logs", dependencies=[Depends(require("governance:read"))])
def audit_logs(limit: int = Query(100, ge=1, le=500), action: str | None = None, db: Session = Depends(get_db)) -> dict:
    stmt = select(AuditLog).order_by(AuditLog.timestamp.desc(), AuditLog.id.desc())
    if action:
        stmt = stmt.where(AuditLog.action == action)
    logs = db.scalars(stmt.limit(limit)).all()
    counts = dict(db.execute(select(AuditLog.action, func.count()).group_by(AuditLog.action)).all())
    return {
        "items": [{"id": log.id, "timestamp": log.timestamp, "actor": log.actor, "role": log.role, "action": log.action,
                   "resource_type": log.resource_type, "resource_id": log.resource_id, "purpose": log.purpose,
                   "details": log.details} for log in logs],
        "counts": counts,
    }


@router.post("/engine/run")
def run_engine(analyst: Analyst = Depends(require("engine:run"))) -> dict:
    """Re-run every engine over the stored raw data (keeps the analysts' workflow statuses)."""
    try:
        run = run_pipeline(regenerate=False, trigger="manual", actor=analyst.id)
    except PipelineBusyError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {**run, "database": "sqlite" if get_settings().is_sqlite else "postgresql"}
