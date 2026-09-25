"""CLI: generate the synthetic dataset and run every engine.

    python -m app.pipeline.seed                     # 5.000 customers (default)
    python -m app.pipeline.seed --customers 20000   # bigger portfolio
    python -m app.pipeline.seed --rerun             # re-run engines over the stored raw data
"""

from __future__ import annotations

import argparse
import datetime as dt
import logging

from app.pipeline.runner import run_pipeline


def main() -> None:
    parser = argparse.ArgumentParser(description="Open Finance Intelligence — seed & engine runner")
    parser.add_argument("--customers", type=int, default=None, help="number of synthetic customers")
    parser.add_argument("--seed", type=int, default=None, help="random seed (reproducible dataset)")
    parser.add_argument("--reference-date", type=dt.date.fromisoformat, default=None, help="YYYY-MM-DD")
    parser.add_argument("--rerun", action="store_true", help="only re-run the engines over existing raw data")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")
    run = run_pipeline(
        regenerate=not args.rerun,
        trigger="manual" if args.rerun else "seed",
        n_customers=args.customers,
        seed=args.seed,
        reference_date=args.reference_date,
    )
    stats = run["stats"]
    print(f"\n✔ {run['run_id']} — {run['duration_ms'] / 1000:.1f}s")
    print(f"  clientes: {run['customers_processed']:,} | oportunidades: {run['opportunities_created']:,} "
          f"| sinais: {run['signals_created']:,} | prioritários: {stats['priority_customers']:,}")
    print(f"  etapas: {stats['stages']}")


if __name__ == "__main__":
    main()
