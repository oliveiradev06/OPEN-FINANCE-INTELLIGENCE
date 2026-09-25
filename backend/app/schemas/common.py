from __future__ import annotations

from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class Schema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class InstitutionRef(Schema):
    institution_id: str
    name: str
    short_name: str
    category: str
    brand_color: str
    is_primary: bool


class Page(Schema, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int


class Evidence(Schema):
    text: str
    kind: str  # support | context | caution


class ScoreFactor(Schema):
    key: str
    label: str
    points: float
    max_points: int
    detail: str


class MetricValue(Schema):
    key: str
    label: str
    value: float | str
    format: str  # currency | percent | number | text | rate


class SeriesPoint(Schema):
    label: str
    value: float
