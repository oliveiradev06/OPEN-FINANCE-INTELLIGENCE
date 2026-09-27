import json

from app.services import ai_insights


def test_portfolio_summary(client):
    data = client.get("/api/portfolio/summary").json()
    assert data["customers"] == 400
    assert data["opportunities"] > 0
    assert data["institutions_connected"] == 12
    assert len(data["trend"]) == 12


def test_priority_customers_always_carry_evidence(client):
    rows = client.get("/api/portfolio/priority-customers?limit=5").json()
    assert rows
    for row in rows:
        assert row["reasons"], "score shown without reasons"
        assert row["score_breakdown"]


def test_customer_list_filters_and_search(client):
    page = client.get("/api/customers?search=joao silva").json()
    assert any(item["customer_id"] == "CUS-00001" for item in page["items"])
    filtered = client.get("/api/customers?opportunity_type=investment&page_size=100").json()
    assert filtered["total"] > 0
    ids = {item["customer_id"] for item in filtered["items"]}
    for cid in list(ids)[:5]:
        types = {o["type"] for o in client.get(f"/api/opportunities?customer_id={cid}").json()["items"]}
        assert "investment" in types


def test_customer_360_for_demo_persona(client):
    data = client.get("/api/customers/CUS-00001").json()
    assert data["customer"]["name"] == "João Silva"
    assert data["metrics"]["institutions_count"] == 4
    assert {n["institution"]["institution_id"] for n in data["ecosystem"]} == {"aurora", "nubank", "btg", "inter"}
    top = data["opportunities"][0]
    assert top["type"] == "investment"
    assert top["evidence"] and top["score_breakdown"]
    assert len(data["timeline"]) == 12


def test_institution_drilldown(client):
    data = client.get("/api/customers/CUS-00001/institutions/btg").json()
    assert data["investments"]
    assert data["consent"]["status"] in {"active", "expiring"}


def test_opportunity_status_workflow_is_audited(client):
    opp_id = client.get("/api/customers/CUS-00002").json()["opportunities"][0]["opportunity_id"]
    updated = client.patch(f"/api/opportunities/{opp_id}", json={"status": "contacted", "note": "Ligação feita"})
    assert updated.status_code == 200
    assert updated.json()["status"] == "contacted"
    logs = client.get("/api/governance/audit-logs?action=opportunity.status_change",
                      headers={"X-Analyst-Role": "coordenador"}).json()["items"]
    assert any(log["resource_id"] == opp_id and log["details"]["to"] == "contacted" for log in logs)


def test_role_based_access(client):
    assert client.get("/api/governance/audit-logs").status_code == 403  # default role: analista
    assert client.get("/api/customers/CUS-00001", headers={"X-Analyst-Role": "auditor"}).status_code == 403
    assert client.post("/api/engine/run").status_code == 403


def test_ai_summary_uses_only_the_fact_sheet(client):
    summary = client.get("/api/customers/CUS-00001/summary").json()
    assert summary["source"] == "template"
    assert "R$ 85.000" in summary["summary"]
    payload = client.get("/api/customers/CUS-00001").json()
    facts = json.dumps(ai_insights.build_fact_sheet(payload), ensure_ascii=False)
    assert "João" not in facts and "CUS-00001" not in facts  # LGPD: no identifiers sent to the LLM


def test_ask_intelligence_explains_score(client):
    answer = client.post("/api/customers/CUS-00001/ask", json={"question": "Por que esse cliente recebeu esse score?"}).json()
    assert "pontos" in answer["answer"]
    assert answer["facts_used"]


def test_engine_rerun_keeps_analyst_status(client):
    opp_id = client.get("/api/customers/CUS-00003").json()["opportunities"][0]["opportunity_id"]
    client.patch(f"/api/opportunities/{opp_id}", json={"status": "in_review"})
    run = client.post("/api/engine/run", headers={"X-Analyst-Role": "coordenador"})
    assert run.status_code == 200
    assert client.get(f"/api/opportunities/{opp_id}").json()["status"] == "in_review"


def test_summary_tracks_open_finance_adoption_and_score_bands(client):
    data = client.get("/api/portfolio/summary").json()
    trend = data["connections_trend"]
    assert len(trend) == 12
    connected = [point["customers_connected"] for point in trend]
    assert connected == sorted(connected) and connected[-1] <= data["customers"]  # cumulative
    assert trend[-1]["new_customers"] == data["new_connections_last_month"]
    bands = data["score_bands"]
    assert [b["key"] for b in bands] == ["very_high", "high", "medium", "low", "very_low"]
    assert sum(b["count"] for b in bands) == data["customers_with_opportunities"]


def test_activity_feed_comes_from_the_data(client):
    items = client.get("/api/portfolio/activity").json()
    assert [i["kind"] for i in items][:2] == ["connections", "opportunities"]
    assert all(i["href"].startswith("/") and i["title"] for i in items)


def test_priority_customers_list_all_their_opportunity_types(client):
    for row in client.get("/api/portfolio/priority-customers?limit=5").json():
        assert row["opportunity_type"] in row["opportunity_types"]


def test_customer_tabs_counts_match_the_list(client):
    counts = client.get("/api/customers/tab-counts").json()
    assert counts["all"] == 400
    for flag, key in (("has_opportunities", "with_opportunities"), ("has_signals", "with_signals"),
                      ("new_connections", "new_connections")):
        assert client.get(f"/api/customers?{flag}=true&page_size=1").json()["total"] == counts[key]
    page = client.get("/api/customers?customer_id=CUS-00001&customer_id=CUS-00002").json()
    assert {i["customer_id"] for i in page["items"]} == {"CUS-00001", "CUS-00002"}
    assert all(i["consent_status"] in {"active", "expiring", "revoked", "none"} for i in page["items"])


def test_customer_360_lists_products_and_reconciles_assets(client):
    data = client.get("/api/customers/CUS-00001").json()
    assert data["products"]["investments"] and data["products"]["accounts"]
    assert abs(sum(s["value"] for s in data["asset_breakdown"]) - data["metrics"]["total_assets"]) < 1


def test_opportunity_history_records_status_changes(client):
    opp_id = client.get("/api/customers/CUS-00005").json()["opportunities"][0]["opportunity_id"]
    client.patch(f"/api/opportunities/{opp_id}", json={"status": "in_review", "note": "Revisar com o gerente"})
    history = client.get(f"/api/opportunities/{opp_id}").json()["history"]
    assert history[0]["kind"] == "status_change" and history[0]["to_status"] == "in_review"
    assert history[-1]["kind"] == "detected"


def test_reports_check_permission_and_are_audited(client):
    reports = {r["key"]: r for r in client.get("/api/reports").json()}
    assert reports["oportunidades"]["available"] and not reports["auditoria"]["available"]
    response = client.get("/api/reports/oportunidades?type=investment")
    assert response.status_code == 200 and response.headers["content-type"].startswith("text/csv")
    lines = response.content.decode("utf-8-sig").splitlines()
    assert lines[0].startswith("Oportunidade;Cliente (ID)") and len(lines) > 1
    assert all(";Investimentos;" in line for line in lines[1:])
    assert client.get("/api/reports/auditoria").status_code == 403
    logs = client.get("/api/governance/audit-logs?action=report.export", headers={"X-Analyst-Role": "coordenador"}).json()["items"]
    assert any(log["resource_id"] == "oportunidades" and log["details"]["rows"] == len(lines) - 1 for log in logs)


def test_meta_exposes_the_engine_reference_numbers_for_simulations(client):
    simulation = client.get("/api/meta").json()["simulation"]
    assert {r["loan_type"] for r in simulation["reference_rates"]} >= {"credito_pessoal", "consignado"}
    assert 0 < simulation["cdi_monthly"] < 0.02


def test_customer_export_follows_the_list_filters(client):
    listed = client.get("/api/customers?segment=Private&page_size=100").json()
    response = client.get("/api/reports/clientes?segment=Private")
    lines = response.content.decode("utf-8-sig").splitlines()
    assert response.status_code == 200 and len(lines) - 1 == listed["total"]
    assert all(";Private;" in line for line in lines[1:])
    selection = client.get("/api/reports/clientes?customer_id=CUS-00001&customer_id=CUS-00003").content.decode("utf-8-sig")
    assert len(selection.splitlines()) == 3
    assert client.get("/api/reports/clientes", headers={"X-Analyst-Role": "auditor"}).status_code == 403
