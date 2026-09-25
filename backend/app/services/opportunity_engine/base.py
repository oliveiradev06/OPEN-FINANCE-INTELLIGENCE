"""Building blocks of the rule-based, explainable opportunity engine.

A rule returns a :class:`Candidate` made of **factors** (each worth a maximum number of points
and scored 0-1 from an observed metric) and **evidence** sentences. The opportunity score is
simply the sum of factor points, so every point can be traced back to a number.
"""

from __future__ import annotations

import math
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from app.core.formatting import brl_compact
from app.data import reference as ref

ENGINE_VERSION = "1.0.0"
MIN_SCORE = 45  # candidates below this are not surfaced to analysts


def scale(value: float, low: float, high: float) -> float:
    """Linear 0-1 scaling clamped to the interval."""
    if high == low:
        return 1.0 if value >= high else 0.0
    return float(min(max((value - low) / (high - low), 0.0), 1.0))


def log_scale(value: float, low: float, high: float) -> float:
    """0-1 scaling on a log axis — money amounts matter in orders of magnitude."""
    if value <= low:
        return 0.0
    return scale(math.log(value), math.log(low), math.log(high))


def nice_floor(value: float) -> float:
    """Round down to a 'human' threshold: 23.400 -> 20.000; 7.800 -> 7.000."""
    if value <= 0:
        return 0.0
    step = 10_000 if value >= 50_000 else 5_000 if value >= 20_000 else 1_000
    return math.floor(value / step) * step


def institution_name(inst_id: str | None, short: bool = True) -> str:
    inst = ref.INSTITUTION_BY_ID.get(inst_id or "", {})
    return inst.get("short_name" if short else "name", inst_id or "—")


def join_names(names: list[str]) -> str:
    names = [n for n in names if n]
    if len(names) <= 1:
        return "".join(names)
    return ", ".join(names[:-1]) + " e " + names[-1]


def priority_for(score: int) -> str:
    if score >= 80:
        return "high"
    if score >= 60:
        return "medium"
    return "low"


@dataclass
class Factor:
    key: str
    label: str
    max_points: int
    achievement: float  # 0..1
    detail: str

    @property
    def points(self) -> float:
        return round(self.max_points * min(max(self.achievement, 0.0), 1.0), 1)

    def to_dict(self) -> dict:
        return {"key": self.key, "label": self.label, "points": self.points,
                "max_points": self.max_points, "detail": self.detail}


@dataclass
class Evidence:
    text: str
    kind: str = "support"  # support | context | caution

    def __post_init__(self) -> None:
        # Sentences ending in "a.m." must not get a second period.
        while self.text.endswith(".."):
            self.text = self.text[:-1]

    def to_dict(self) -> dict:
        return {"text": self.text, "kind": self.kind}


@dataclass
class Metric:
    key: str
    label: str
    value: float | str
    format: str = "currency"  # currency | percent | number | text | rate

    def to_dict(self) -> dict:
        return {"key": self.key, "label": self.label, "value": self.value, "format": self.format}


@dataclass
class Candidate:
    type: str
    estimated_value: float
    summary: str
    factors: list[Factor]
    evidence: list[Evidence]
    metrics: list[Metric]
    recommended_action: str
    context: dict[str, Any] = field(default_factory=dict)

    @property
    def score(self) -> int:
        return int(min(max(round(sum(f.points for f in self.factors)), 0), 100))


class Rule(ABC):
    rule_id: str
    type: str
    name: str
    description: str
    params: dict[str, float]

    @abstractmethod
    def evaluate(self, f: dict, ctx: dict) -> Candidate | None:
        """Return a candidate when the customer matches the rule, else None."""

    def describe(self) -> dict:
        return {
            "rule_id": self.rule_id, "type": self.type, "name": self.name,
            "label": ref.OPPORTUNITY_TYPES[self.type]["label"], "description": self.description,
            "params": self.params, "version": ENGINE_VERSION,
        }


def money(value: float) -> str:
    return brl_compact(value)
