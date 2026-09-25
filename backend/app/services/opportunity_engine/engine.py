from __future__ import annotations

import datetime as dt

import pandas as pd

from app.data import reference as ref
from app.services.opportunity_engine.base import ENGINE_VERSION, MIN_SCORE, Rule, priority_for
from app.services.opportunity_engine.rules import default_rules

TYPE_CODES = {
    "investment": "INV", "idle_cash": "IDL", "debt_optimization": "DBT", "credit": "CRD",
    "relationship": "REL", "retention": "RET", "spending_migration": "SPM",
}

COLUMNS = [
    "opportunity_id", "customer_id", "type", "score", "priority", "estimated_value", "title", "summary",
    "evidence", "score_breakdown", "metrics", "context", "recommended_action", "rule_id", "engine_version",
    "status", "created_at", "updated_at",
]


class OpportunityEngine:
    """Runs every rule over every customer and returns explainable opportunities."""

    def __init__(self, rules: list[Rule] | None = None, min_score: int = MIN_SCORE) -> None:
        self.rules = rules or default_rules()
        self.min_score = min_score

    def evaluate_customer(self, customer_id: str, features: dict, context: dict, now: dt.datetime) -> list[dict]:
        found = []
        for rule in self.rules:
            candidate = rule.evaluate(features, context)
            if candidate is None or candidate.score < self.min_score:
                continue
            found.append({
                # Stable id: re-running the engine keeps the analyst's workflow status.
                "opportunity_id": f"OPP-{customer_id[4:]}-{TYPE_CODES[rule.type]}",
                "customer_id": customer_id,
                "type": rule.type,
                "score": candidate.score,
                "priority": priority_for(candidate.score),
                "estimated_value": candidate.estimated_value,
                "title": ref.OPPORTUNITY_TYPES[rule.type]["title"],
                "summary": candidate.summary,
                "evidence": [e.to_dict() for e in candidate.evidence],
                "score_breakdown": [f.to_dict() for f in candidate.factors],
                "metrics": [m.to_dict() for m in candidate.metrics],
                "context": candidate.context,
                "recommended_action": candidate.recommended_action,
                "rule_id": rule.rule_id,
                "engine_version": ENGINE_VERSION,
                "status": "new",
                "created_at": now,
                "updated_at": now,
            })
        return found

    def run(self, features: pd.DataFrame, contexts: dict[str, dict], now: dt.datetime) -> pd.DataFrame:
        rows: list[dict] = []
        empty = {"institutions": [], "loans": [], "cards": [], "investments": []}
        for cid, f in zip(features.index, features.to_dict("records"), strict=True):
            rows.extend(self.evaluate_customer(cid, f, contexts.get(cid, empty), now))
        return pd.DataFrame(rows, columns=COLUMNS)

    def describe(self) -> list[dict]:
        return [rule.describe() for rule in self.rules]
