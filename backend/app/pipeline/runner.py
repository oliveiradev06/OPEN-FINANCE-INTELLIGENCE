"""Pipeline orchestration.

    raw layer (generate or load)  ->  ETL (monthly metrics, relationship graph)
    ->  features  ->  engines (health, behaviour, opportunities, segmentation, anomalies)
    ->  portfolio insights  ->  persist curated tables

``run_pipeline(regenerate=True)`` rebuilds everything from a fresh synthetic dataset (seed).
``run_pipeline(regenerate=False)`` re-runs the engines over the raw data already stored — the
same path a daily batch would take after new Open Finance data arrives.
"""

from __future__ import annotations

import datetime as dt
import logging
import math
import threading
import time
import uuid
from collections.abc import Iterable
from dataclasses import dataclass

import numpy as np
import pandas as pd
from sqlalchemy import JSON, Table, delete, func, insert, inspect, select

from app import models as m
from app.core.config import get_settings
from app.core.database import Base, engine
from app.core.formatting import normalize_text
from app.data.generator import SyntheticDataGenerator
from app.ml.anomaly import detect_anomalies
from app.ml.segmentation import segment_customers
from app.pipeline.etl import build_customer_institutions, build_monthly_metrics
from app.pipeline.features import build_contexts, build_features
from app.services.behavior_analysis import detect_signals
from app.services.financial_health import compute_health
from app.services.opportunity_engine import ENGINE_VERSION, OpportunityEngine
from app.services.portfolio_insights import generate_insights

logger = logging.getLogger("ofi.pipeline")
_lock = threading.Lock()

RAW_TABLES: list[Table] = [
    m.Institution.__table__, m.Customer.__table__, m.Account.__table__, m.CreditCard.__table__,
    m.Investment.__table__, m.Loan.__table__, m.Transaction.__table__, m.BalanceSnapshot.__table__,
    m.Consent.__table__,
]
DERIVED_TABLES: list[Table] = [  # insertion order (parents first)
    m.Segment.__table__, m.CustomerMonthlyMetric.__table__, m.CustomerInstitution.__table__,
    m.CustomerMetrics.__table__, m.BehaviorSignal.__table__, m.Opportunity.__table__,
    m.PortfolioInsight.__table__, m.InsightCustomer.__table__,
]


class PipelineBusyError(RuntimeError):
    pass


@dataclass
class RawData:
    customers: pd.DataFrame
    accounts: pd.DataFrame
    credit_cards: pd.DataFrame
    investments: pd.DataFrame
    loans: pd.DataFrame
    transactions: pd.DataFrame
    balance_snapshots: pd.DataFrame
    consents: pd.DataFrame
    months: list[dt.date]
    reference_date: dt.date


# -- persistence helpers ---------------------------------------------------------------------


def _to_python(value):
    if value is None:
        return None
    if isinstance(value, float | np.floating):
        return None if math.isnan(value) else float(value)
    if isinstance(value, np.integer):
        return int(value)
    if isinstance(value, np.bool_):
        return bool(value)
    if isinstance(value, pd.Timestamp):
        return value.to_pydatetime()
    return value


def _records(df: pd.DataFrame, columns: list[str]) -> list[dict]:
    # astype(object) already yields Python scalars for numeric/bool columns; only NaN/NaT need care.
    frame = df[columns].astype(object)
    return frame.where(df[columns].notna(), None).to_dict("records")


def _chunks(items: list, size: int) -> Iterable[list]:
    for start in range(0, len(items), size):
        yield items[start:start + size]


def bulk_insert(conn, table: Table, df: pd.DataFrame) -> int:
    if df is None or df.empty:
        return 0
    autoinc = {c.name for c in table.primary_key.columns if c.autoincrement is True}
    columns = [c.name for c in table.columns if c.name in df.columns and c.name not in autoinc]
    has_json = any(isinstance(table.c[c].type, JSON) for c in columns)
    if conn.dialect.name == "postgresql" and not has_json and len(df) > 5000:
        # COPY is an order of magnitude faster than INSERT for the large fact tables.
        dbapi = conn.connection.driver_connection
        frame = df[columns].astype(object)
        with dbapi.cursor() as cur, cur.copy(f"COPY {table.name} ({', '.join(columns)}) FROM STDIN") as copy:
            for row in frame.itertuples(index=False, name=None):
                copy.write_row([_to_python(v) for v in row])
        return len(df)
    records = _records(df, columns)
    for chunk in _chunks(records, 20000):
        conn.execute(insert(table), chunk)
    return len(records)


def database_is_empty() -> bool:
    if not inspect(engine).has_table(m.Customer.__tablename__):
        return True
    with engine.connect() as conn:
        return (conn.execute(select(func.count()).select_from(m.Customer.__table__)).scalar() or 0) == 0


# -- raw layer --------------------------------------------------------------------------------


def _write_raw(conn, dataset) -> dict[str, int]:
    frames = {
        "institutions": dataset.institutions, "customers": dataset.customers, "accounts": dataset.accounts,
        "credit_cards": dataset.credit_cards, "investments": dataset.investments, "loans": dataset.loans,
        "transactions": dataset.transactions, "balance_snapshots": dataset.balance_snapshots,
        "consents": dataset.consents,
    }
    counts = {}
    for table in RAW_TABLES:
        counts[table.name] = bulk_insert(conn, table, frames[table.name])
    return counts


def _read(conn, table: Table, date_columns: tuple[str, ...] = ()) -> pd.DataFrame:
    df = pd.read_sql(select(table), conn)
    for col in date_columns:
        df[col] = pd.to_datetime(df[col]).dt.date
    return df


def load_raw(reference_date: dt.date | None) -> RawData:
    with engine.connect() as conn:
        snapshots = _read(conn, m.BalanceSnapshot.__table__, ("month",))
        raw = RawData(
            customers=_read(conn, m.Customer.__table__, ("relationship_since",)),
            accounts=_read(conn, m.Account.__table__),
            credit_cards=_read(conn, m.CreditCard.__table__),
            investments=_read(conn, m.Investment.__table__),
            loans=_read(conn, m.Loan.__table__),
            transactions=_read(conn, m.Transaction.__table__, ("date",)),
            balance_snapshots=snapshots,
            consents=_read(conn, m.Consent.__table__),
            months=sorted(snapshots["month"].unique().tolist()),
            reference_date=reference_date or dt.date.today(),
        )
    return raw


# -- derived layer ----------------------------------------------------------------------------


def _json_safe(features: pd.DataFrame) -> list[dict]:
    rows = []
    for rec in features.to_dict("records"):
        rows.append({k: _to_python(v) for k, v in rec.items()})
    return rows


def compute_derived(raw: RawData, now: dt.datetime) -> dict:
    primary = get_settings().primary_institution_id
    timings: dict[str, float] = {}

    def timed(name: str, fn, *args, **kwargs):
        start = time.perf_counter()
        result = fn(*args, **kwargs)
        timings[name] = round(time.perf_counter() - start, 3)
        return result

    monthly = timed("etl_monthly", build_monthly_metrics, raw.transactions, raw.balance_snapshots,
                    raw.customers["customer_id"], raw.months, primary)
    links = timed("etl_links", build_customer_institutions, raw.accounts, raw.credit_cards, raw.investments,
                  raw.loans, raw.transactions, monthly, raw.months)
    features = timed("features", build_features, raw.customers, monthly, links, raw.loans, raw.credit_cards,
                     raw.months, raw.reference_date, primary)
    contexts = build_contexts(links, raw.loans, raw.credit_cards, raw.investments)
    health = timed("financial_health", compute_health, features)
    signals = timed("behavior_analysis", detect_signals, features, raw.months[-1])
    opportunities = timed("opportunity_engine", OpportunityEngine().run, features, contexts, now)
    segmentation = timed("segmentation", segment_customers, features, health["health_score"])
    anomalies = timed("anomaly_detection", detect_anomalies, features)
    insights, members = timed("portfolio_insights", generate_insights, features, health, signals, opportunities,
                              monthly, links, anomalies, raw.months, now)

    idx = features.index
    top = (opportunities.sort_values("score", ascending=False).drop_duplicates("customer_id")
           .set_index("customer_id").reindex(idx))
    per_customer = opportunities.groupby("customer_id").agg(
        opportunities_count=("score", "size"), opportunity_value=("estimated_value", "sum")
    ).reindex(idx, fill_value=0)
    last_sync = raw.consents[raw.consents["status"] != "revoked"].groupby("customer_id")["last_sync_at"].max()
    last_sync = pd.to_datetime(last_sync).reindex(idx).fillna(pd.Timestamp(now))

    names = raw.customers.set_index("customer_id")["name"].reindex(idx)
    customer_metrics = pd.DataFrame({
        "customer_id": idx,
        "search_text": [f"{normalize_text(name)} {cid.lower()}" for cid, name in zip(idx, names, strict=True)],
        "monthly_income": features["income_avg_6m"].round(2).to_numpy(),
        "monthly_expenses": features["expenses_avg_6m"].round(2).to_numpy(),
        "total_balance": features["liquid_total"].round(2).to_numpy(),
        "total_investments": features["investments_total"].round(2).to_numpy(),
        "total_assets": features["total_assets"].round(2).to_numpy(),
        "total_debt": features["debt_total"].round(2).to_numpy(),
        "expensive_debt": features["expensive_debt"].round(2).to_numpy(),
        "net_worth": features["net_worth"].round(2).to_numpy(),
        "institutions_count": features["institutions_count"].astype(int).to_numpy(),
        "external_asset_share": features["external_asset_share"].to_numpy(),
        "card_external_share": features["card_external_share_3m"].to_numpy(),
        "debt_service_ratio": features["debt_service_ratio"].to_numpy(),
        "debt_level": features["debt_level"].to_numpy(),
        "health_score": health["health_score"].to_numpy(),
        "health_band": health["health_band"].to_numpy(),
        "health_components": health["health_components"].to_numpy(),
        "opportunity_score": top["score"].fillna(0).astype(int).to_numpy(),
        "top_opportunity_type": top["type"].astype(object).where(top["type"].notna(), None).to_numpy(),
        "opportunities_count": per_customer["opportunities_count"].astype(int).to_numpy(),
        "opportunity_value": per_customer["opportunity_value"].round(2).to_numpy(),
        "signals_count": signals.groupby("customer_id").size().reindex(idx, fill_value=0).astype(int).to_numpy(),
        "segment_id": segmentation.labels.reindex(idx).astype(int).to_numpy(),
        "anomaly_score": anomalies["anomaly_score"].to_numpy(),
        "is_anomaly": anomalies["is_anomaly"].to_numpy(),
        "anomaly_reasons": anomalies["anomaly_reasons"].to_numpy(),
        "features": _json_safe(features),
        "last_sync_at": last_sync.to_numpy(),
        "updated_at": now,
    })

    return {
        "monthly": monthly,
        "links": links,
        "customer_metrics": customer_metrics,
        "signals": signals,
        "opportunities": opportunities,
        "segments": segmentation.segments,
        "insights": pd.DataFrame(insights),
        "insight_members": pd.DataFrame(members, columns=["insight_id", "customer_id"]),
        "stats": {
            "timings": timings,
            "silhouette": segmentation.silhouette,
            "segments": int(segmentation.k),
            "anomalies": int(anomalies["is_anomaly"].sum()),
            "opportunities_by_type": {str(k): int(v) for k, v in opportunities["type"].value_counts().items()},
            "signals_by_type": {str(k): int(v) for k, v in signals["signal_type"].value_counts().items()},
            "priority_customers": int((customer_metrics["opportunity_score"] >= 80).sum()),
        },
    }


def _persist_derived(conn, derived: dict, preserve_status: bool) -> None:
    opportunities = derived["opportunities"]
    if preserve_status:
        previous = {
            row.opportunity_id: (row.status, row.created_at)
            for row in conn.execute(select(m.Opportunity.opportunity_id, m.Opportunity.status, m.Opportunity.created_at))
        }
        if previous:
            opportunities = opportunities.copy()
            kept = opportunities["opportunity_id"].map(previous)
            mask = kept.notna()
            opportunities.loc[mask, "status"] = [v[0] for v in kept[mask]]
            opportunities.loc[mask, "created_at"] = [v[1] for v in kept[mask]]

    for table in reversed(DERIVED_TABLES):
        conn.execute(delete(table))
    frames = {
        "segments": derived["segments"], "customer_monthly_metrics": derived["monthly"],
        "customer_institutions": derived["links"], "customer_metrics": derived["customer_metrics"],
        "behavior_signals": derived["signals"], "opportunities": opportunities,
        "portfolio_insights": derived["insights"], "portfolio_insight_customers": derived["insight_members"],
    }
    for table in DERIVED_TABLES:
        bulk_insert(conn, table, frames[table.name])


# -- entry point ------------------------------------------------------------------------------


def _last_reference_date() -> dt.date | None:
    with engine.connect() as conn:
        row = conn.execute(
            select(m.EngineRun.stats).where(m.EngineRun.trigger == "seed").order_by(m.EngineRun.started_at.desc()).limit(1)
        ).first()
    if row and row[0] and row[0].get("reference_date"):
        return dt.date.fromisoformat(row[0]["reference_date"])
    return None


def run_pipeline(
    *,
    regenerate: bool,
    trigger: str = "manual",
    actor: str = "system",
    n_customers: int | None = None,
    seed: int | None = None,
    reference_date: dt.date | None = None,
) -> dict:
    if not _lock.acquire(blocking=False):
        raise PipelineBusyError("O motor já está em execução.")
    try:
        settings = get_settings()
        started = dt.datetime.now().replace(microsecond=0)
        clock = time.perf_counter()
        stages: dict[str, float] = {}
        counts: dict[str, int] = {}

        if regenerate:
            logger.info("Recriando o schema do banco de dados...")
            Base.metadata.drop_all(engine)
            Base.metadata.create_all(engine)
            ref_date = reference_date or settings.reference_date or dt.date.today()
            t = time.perf_counter()
            dataset = SyntheticDataGenerator(
                n_customers=n_customers or settings.seed_customers,
                n_months=settings.seed_months,
                seed=seed if seed is not None else settings.seed_random_state,
                reference_date=ref_date,
                primary_institution_id=settings.primary_institution_id,
            ).generate()
            stages["generate"] = round(time.perf_counter() - t, 2)
            logger.info("Dados sintéticos gerados: %s", dataset.counts())
            t = time.perf_counter()
            with engine.begin() as conn:
                counts = _write_raw(conn, dataset)
            stages["load_raw"] = round(time.perf_counter() - t, 2)
            raw = RawData(
                customers=dataset.customers, accounts=dataset.accounts, credit_cards=dataset.credit_cards,
                investments=dataset.investments, loans=dataset.loans, transactions=dataset.transactions,
                balance_snapshots=dataset.balance_snapshots, consents=dataset.consents,
                months=dataset.months, reference_date=dataset.reference_date,
            )
        else:
            Base.metadata.create_all(engine)
            t = time.perf_counter()
            raw = load_raw(_last_reference_date())
            stages["read_raw"] = round(time.perf_counter() - t, 2)
            counts = {"customers": len(raw.customers), "transactions": len(raw.transactions)}

        t = time.perf_counter()
        derived = compute_derived(raw, started)
        stages["engines"] = round(time.perf_counter() - t, 2)
        logger.info("Motores executados: %s", derived["stats"]["opportunities_by_type"])

        t = time.perf_counter()
        with engine.begin() as conn:
            _persist_derived(conn, derived, preserve_status=not regenerate)
        stages["persist"] = round(time.perf_counter() - t, 2)

        duration_ms = int((time.perf_counter() - clock) * 1000)
        stats = {
            **derived["stats"], "stages": stages, "counts": counts,
            "reference_date": raw.reference_date.isoformat(),
            "months": [raw.months[0].isoformat(), raw.months[-1].isoformat()],
        }
        run = {
            "run_id": f"RUN-{started:%Y%m%d%H%M%S}-{uuid.uuid4().hex[:4]}",
            "started_at": started, "finished_at": started + dt.timedelta(milliseconds=duration_ms),
            "duration_ms": duration_ms, "status": "success", "trigger": trigger, "engine_version": ENGINE_VERSION,
            "customers_processed": len(raw.customers), "opportunities_created": len(derived["opportunities"]),
            "signals_created": len(derived["signals"]), "stats": stats,
        }
        with engine.begin() as conn:
            conn.execute(insert(m.EngineRun.__table__), [run])
            conn.execute(insert(m.AuditLog.__table__), [{
                "timestamp": dt.datetime.now().replace(microsecond=0), "actor": actor,
                "role": "sistema" if actor == "system" else settings.default_analyst_role,
                "action": "engine.run", "resource_type": "engine", "resource_id": run["run_id"],
                "purpose": "Execução do motor de oportunidades", "details": {"trigger": trigger, "duration_ms": duration_ms},
            }])
        logger.info("Pipeline concluído em %.1fs", duration_ms / 1000)
        return run
    finally:
        _lock.release()
