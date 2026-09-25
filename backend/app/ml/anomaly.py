"""Anomaly detection on quarter-over-quarter behaviour changes (Isolation Forest)."""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from app.core.formatting import pct

CHANGE_FEATURES = {
    "expenses_change": "Gastos",
    "balance_primary_change": "Saldo no banco principal",
    "income_change": "Renda",
    "card_external_spend_change": "Gastos em cartões concorrentes",
    "investments_primary_change": "Investimentos no banco principal",
    "debt_change": "Endividamento",
}


def detect_anomalies(features: pd.DataFrame, contamination: float = 0.03, seed: int = 42) -> pd.DataFrame:
    X = features[list(CHANGE_FEATURES)].clip(-1.0, 3.0).fillna(0.0)
    model = IsolationForest(n_estimators=200, contamination=contamination, random_state=seed).fit(X)
    raw = -model.score_samples(X)  # higher = more anomalous
    score = (raw - raw.min()) / (raw.max() - raw.min() + 1e-9)
    flagged = model.predict(X) == -1

    z = (X - X.mean()) / (X.std(ddof=0) + 1e-9)
    reasons = []
    for i, is_anomaly in enumerate(flagged):
        if not is_anomaly:
            reasons.append([])
            continue
        top = z.iloc[i].abs().sort_values(ascending=False).index[:2]
        reasons.append([f"{CHANGE_FEATURES[c]} {pct(float(X.iloc[i][c]), signed=True)} no trimestre" for c in top])

    return pd.DataFrame({
        "anomaly_score": np.round(score, 4),
        "is_anomaly": flagged,
        "anomaly_reasons": reasons,
    }, index=features.index)
