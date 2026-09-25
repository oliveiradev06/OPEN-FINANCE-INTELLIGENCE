"""Behavioural segmentation with KMeans.

Clusters are named automatically: each centroid is compared with a set of archetypes and the
best one-to-one assignment (Hungarian algorithm) gives every segment a business name.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy.optimize import linear_sum_assignment
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler

FEATURES = [
    "log_income", "log_assets", "external_asset_share", "card_external_share_3m",
    "debt_service_ratio", "liquidity_months", "surplus_ratio", "institutions_count", "health_score",
]

# Archetype -> weights over standardized centroid features (positive = above portfolio average).
ARCHETYPES: dict[str, dict] = {
    "Investidores multibanco": {
        "weights": {"external_asset_share": 1.2, "log_assets": 0.8, "institutions_count": 0.4},
        "description": "Patrimônio relevante distribuído entre várias instituições, com investimentos majoritariamente fora do banco.",
    },
    "Poupadores conservadores": {
        "weights": {"liquidity_months": 1.2, "external_asset_share": -0.6, "debt_service_ratio": -0.5, "health_score": 0.4},
        "description": "Mantêm muita liquidez no banco principal, pouca dívida e baixa movimentação — potencial de saldo ocioso.",
    },
    "Endividados em atenção": {
        "weights": {"debt_service_ratio": 1.3, "health_score": -1.0, "surplus_ratio": -0.6},
        "description": "Alto comprometimento de renda com parcelas e fluxo de caixa pressionado. Requer abordagem consultiva.",
    },
    "Digitais multibancarizados": {
        "weights": {"card_external_share_3m": 1.2, "institutions_count": 0.8, "log_assets": -0.3},
        "description": "Usam vários bancos digitais e concentram gastos em cartões de outras instituições.",
    },
    "Alta renda concentrada": {
        "weights": {"log_income": 1.1, "log_assets": 0.7, "external_asset_share": -0.7, "health_score": 0.3},
        "description": "Renda elevada e relacionamento concentrado no banco principal — foco em retenção e aprofundamento.",
    },
    "Relacionamento básico": {
        "weights": {"log_income": -0.9, "log_assets": -0.9, "institutions_count": -0.4},
        "description": "Renda e patrimônio menores, poucos produtos — foco em educação financeira e primeiro investimento.",
    },
}


@dataclass
class SegmentationResult:
    labels: pd.Series  # customer_id -> segment_id
    segments: pd.DataFrame
    silhouette: float
    k: int


def _matrix(features: pd.DataFrame, health_score: pd.Series) -> pd.DataFrame:
    return pd.DataFrame({
        "log_income": np.log1p(features["income_avg_6m"].clip(lower=0)),
        "log_assets": np.log1p(features["total_assets"].clip(lower=0)),
        "external_asset_share": features["external_asset_share"].clip(0, 1),
        "card_external_share_3m": features["card_external_share_3m"].clip(0, 1),
        "debt_service_ratio": features["debt_service_ratio"].clip(0, 1),
        "liquidity_months": features["liquidity_months"].clip(0, 24),
        "surplus_ratio": features["surplus_ratio"].clip(-0.5, 0.6),
        "institutions_count": features["institutions_count"].astype(float),
        "health_score": health_score.astype(float),
    }, index=features.index)


def segment_customers(features: pd.DataFrame, health_score: pd.Series, k: int = 6, seed: int = 42) -> SegmentationResult:
    X = _matrix(features, health_score)
    scaler = StandardScaler()
    Z = scaler.fit_transform(X)
    model = KMeans(n_clusters=k, n_init=10, random_state=seed).fit(Z)
    labels = model.labels_

    sample = np.random.default_rng(seed).choice(len(Z), size=min(2000, len(Z)), replace=False)
    silhouette = float(silhouette_score(Z[sample], labels[sample])) if k > 1 else 0.0

    # Name clusters: score every (cluster, archetype) pair and solve the assignment problem.
    names = list(ARCHETYPES)
    centers = pd.DataFrame(model.cluster_centers_, columns=FEATURES)
    affinity = np.zeros((k, len(names)))
    for j, name in enumerate(names):
        for feat, weight in ARCHETYPES[name]["weights"].items():
            affinity[:, j] += weight * centers[feat].to_numpy()
    rows, cols = linear_sum_assignment(-affinity)
    cluster_name = {int(r): names[c] for r, c in zip(rows, cols, strict=True)}

    frame = X.assign(cluster=labels, income=features["income_avg_6m"], assets=features["total_assets"],
                     opportunity=0)
    segments = []
    for cluster in range(k):
        part = frame[frame["cluster"] == cluster]
        name = cluster_name.get(cluster, f"Segmento {cluster + 1}")
        segments.append({
            "segment_id": cluster + 1,
            "name": name,
            "description": ARCHETYPES.get(name, {}).get("description", ""),
            "size": int(len(part)),
            "profile": {
                "avg_income": round(float(part["income"].mean()), 2),
                "avg_assets": round(float(part["assets"].mean()), 2),
                "median_assets": round(float(part["assets"].median()), 2),
                "external_asset_share": round(float(part["external_asset_share"].mean()), 4),
                "card_external_share": round(float(part["card_external_share_3m"].mean()), 4),
                "debt_service_ratio": round(float(part["debt_service_ratio"].mean()), 4),
                "liquidity_months": round(float(part["liquidity_months"].mean()), 2),
                "institutions": round(float(part["institutions_count"].mean()), 2),
                "health_score": round(float(part["health_score"].mean()), 1),
                "centroid": {feat: round(float(centers.loc[cluster, feat]), 3) for feat in FEATURES},
            },
        })
    return SegmentationResult(
        labels=pd.Series(labels + 1, index=features.index, name="segment_id"),
        segments=pd.DataFrame(segments),
        silhouette=round(silhouette, 3),
        k=k,
    )
