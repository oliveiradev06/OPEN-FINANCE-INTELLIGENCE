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
