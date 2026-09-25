import pandas as pd

from app.services.financial_health import COMPONENTS, band_for, compute_health


def test_weights_sum_to_one():
    assert abs(sum(c["weight"] for c in COMPONENTS) - 1.0) < 1e-9


def test_bands():
    assert band_for(84) == ("excellent", "Excelente")
    assert band_for(70)[0] == "healthy"
    assert band_for(50)[0] == "attention"
    assert band_for(20)[0] == "critical"


def test_health_is_explained_per_component(features):
    frame = pd.DataFrame([{**features, "investment_net_avg_6m": 600.0, "liquidity_months": 1.2,
                           "savings_rate": 0.075, "investments_to_income": 0.4}], index=["CUS-1"])
    result = compute_health(frame).iloc[0]
    assert 0 <= result["health_score"] <= 100
    components = result["health_components"]
    assert [c["key"] for c in components] == [c["key"] for c in COMPONENTS]
    assert all(c["explanation"] and c["display"] for c in components)
    assert abs(sum(c["points"] for c in components) - result["health_score"]) <= 1
