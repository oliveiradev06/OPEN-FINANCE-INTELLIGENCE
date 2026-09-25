"""Small helpers that turn ORM rows into API payloads with display labels."""

from __future__ import annotations

from app.data import reference as ref
from app.models import BehaviorSignal, Opportunity
from app.services.behavior_analysis import SIGNAL_TYPES
from app.services.financial_health import band_for


def institution_ref(institution_id: str) -> dict:
    inst = ref.INSTITUTION_BY_ID[institution_id]
    return {k: inst[k] for k in ("institution_id", "name", "short_name", "category", "brand_color", "is_primary")}


def band_label(band: str) -> str:
    return {"excellent": "Excelente", "healthy": "Saudável", "attention": "Atenção", "critical": "Crítica"}.get(band, band)


def health_out(score: int, components: list[dict]) -> dict:
    band, label = band_for(score)
    return {"score": score, "band": band, "band_label": label, "components": components}


def opportunity_out(o: Opportunity) -> dict:
    return {
        "opportunity_id": o.opportunity_id, "customer_id": o.customer_id, "type": o.type,
        "type_label": ref.OPPORTUNITY_TYPES[o.type]["label"], "title": o.title, "score": o.score,
        "priority": o.priority, "estimated_value": o.estimated_value, "summary": o.summary,
        "evidence": o.evidence, "score_breakdown": o.score_breakdown, "metrics": o.metrics,
        "context": o.context, "recommended_action": o.recommended_action, "rule_id": o.rule_id,
        "engine_version": o.engine_version, "status": o.status,
        "status_label": ref.OPPORTUNITY_STATUSES.get(o.status, o.status),
        "created_at": o.created_at, "updated_at": o.updated_at,
    }


def signal_out(s: BehaviorSignal) -> dict:
    return {
        "signal_id": s.signal_id, "customer_id": s.customer_id, "signal_type": s.signal_type,
        "type_label": SIGNAL_TYPES.get(s.signal_type, s.signal_type), "severity": s.severity,
        "title": s.title, "description": s.description, "metric_before": s.metric_before,
        "metric_after": s.metric_after, "change_pct": s.change_pct, "detected_at": s.detected_at,
        "details": s.details or {},
    }
