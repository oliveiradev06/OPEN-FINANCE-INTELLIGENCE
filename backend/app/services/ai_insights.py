"""AI Insight Engine — explains facts that the analytical engines already computed.

Guardrails by design:
* The LLM receives only a **fact sheet** built from engine outputs (scores, evidence, signals,
  positions per institution). No transactions, no name, no identifiers (LGPD minimization).
* The system prompt forbids new numbers, institutions or intents, and any credit decision.
* When no API key is configured — or the call fails or is declined — a deterministic template
  writer produces the text from the *same* facts, and the response says which source was used.
"""

from __future__ import annotations

import datetime as dt
import json
import logging
import threading
from collections import OrderedDict

import anthropic

from app.core.config import get_settings
from app.core.formatting import brl, month_label, normalize_text, number, pct
from app.data import reference as ref

logger = logging.getLogger("ofi.ai")

DISCLAIMER = ("Texto gerado a partir dos fatos calculados pela plataforma. Apoia a análise; "
              "não constitui decisão de crédito, limite ou bloqueio.")
FALLBACK_MODELS = {"claude-opus-5", "claude-fable-5-1"}  # models that take `fallbacks: "default"`

SYSTEM_PROMPT = """Você é o módulo explicativo da plataforma Open Finance Intelligence, usada por analistas de um banco brasileiro.

Você recebe uma FICHA DE FATOS em JSON, calculada pelos motores analíticos da plataforma (scores, evidências, sinais de comportamento e posições por instituição). Seu papel é explicar esses fatos para o analista em linguagem natural.

Regras:
- Use exclusivamente as informações da ficha. Não invente números, instituições, produtos, datas, motivos ou intenções do cliente.
- Copie os valores exatamente como aparecem na ficha; eles já estão formatados em pt-BR.
- Se a ficha não contém a informação pedida, diga que ela não está disponível nos dados analisados.
- A plataforma apoia o analista e não toma decisões: nunca recomende aprovar, negar ou alterar crédito, limites ou bloqueios.
- Escreva em português do Brasil, com tom profissional, claro e objetivo.
- Responda em texto corrido, sem títulos, listas ou markdown."""

SUMMARY_TASK = ("Escreva um resumo de 3 a 5 frases sobre a vida financeira do cliente nos últimos meses: como renda, "
                "gastos, patrimônio e dívidas se comportam, onde os recursos estão distribuídos, qual é a principal "
                "oportunidade detectada e por que ela foi detectada.")

CLOSINGS = {
    "investment": "Isso indica uma possível oportunidade de aprofundamento do relacionamento de investimentos.",
    "idle_cash": "Isso indica recursos parados que poderiam ser mais bem aplicados, preservando a liquidez do cliente.",
    "debt_optimization": "Isso indica uma ineficiência financeira: o cliente paga juros altos enquanto mantém saldo disponível.",
    "credit": "Isso indica potencial de portabilidade de crédito com economia para o cliente, sujeita à análise de crédito.",
    "relationship": "Isso indica um relacionamento fragmentado, com espaço para uma oferta integrada.",
    "retention": "Isso indica risco de redução do relacionamento com o banco e sugere contato prioritário.",
    "spending_migration": "Isso indica que a maior parte do consumo do cliente acontece fora do banco principal.",
}
DEBT_LEVEL_TEXT = {"low": "baixo nível de endividamento", "moderate": "endividamento moderado", "high": "endividamento elevado"}
PRODUCT_LABELS = {"salario": "salário", "conta": "conta", "cartao": "cartão", "investimentos": "investimentos", "emprestimo": "empréstimo"}


class AIUnavailable(Exception):
    pass


# -- fact sheet --------------------------------------------------------------------------------


def build_fact_sheet(c360: dict) -> dict:
    """Structured, pre-formatted facts — the only thing the LLM ever sees about the customer."""
    m, cust, health = c360["metrics"], c360["customer"], c360["health"]
    avg = c360["cash_flow"]["average_6m"]
    facts = {
        "mes_de_referencia": month_label(c360["reference_month"], full=True),
        "perfil": {
            "faixa_etaria": cust["age_range"],
            "ocupacao": cust["occupation_category"],
            "segmento": cust["segment"],
            "segmento_comportamental": (c360.get("segment") or {}).get("name"),
            "tempo_de_relacionamento": f"{number(cust['tenure_years'], 1)} anos",
            "instituicao_que_recebe_o_salario": cust["primary_bank"]["short_name"],
        },
        "media_mensal_ultimos_6_meses": {
            "renda": brl(avg["income"]), "gastos": brl(avg["expenses"]), "parcelas_de_dividas": brl(avg["debt_payments"]),
            "aplicacoes_liquidas": brl(avg["investments"]), "sobra_apos_aplicacoes": brl(avg["available"]),
        },
        "posicao_atual": {
            "patrimonio_total": brl(m["total_assets"]), "saldo_em_conta": brl(m["total_balance"]),
            "investimentos": brl(m["total_investments"]), "dividas": brl(m["total_debt"]),
            "dividas_caras_acima_de_3_am": brl(m["expensive_debt"]),
            "comprometimento_da_renda_com_parcelas": pct(m["debt_service_ratio"]),
            "nivel_de_endividamento": DEBT_LEVEL_TEXT.get(m["debt_level"], m["debt_level"]),
            "instituicoes_conectadas": m["institutions_count"],
            "patrimonio_fora_do_banco_principal": pct(m["external_asset_share"]),
            "gastos_com_cartao_fora_do_banco_principal": pct(m["card_external_share"]),
        },
        "saude_financeira": {
            "score": f"{health['score']}/100", "faixa": health["band_label"],
            "componentes": [{"nome": c["label"], "nota": f"{round(c['score'])}/100", "leitura": c["display"],
                             "explicacao": c["explanation"]} for c in health["components"]],
        },
        "recursos_por_instituicao": [{
            "instituicao": node["institution"]["name"],
            "banco_principal": node["institution"]["is_primary"],
            "produtos": [PRODUCT_LABELS.get(p, p) for p in node["products"]],
            "saldo_em_conta": brl(node["account_balance"]), "investimentos": brl(node["investment_balance"]),
            "dividas": brl(node["debt_balance"]), "gasto_mensal_no_cartao": brl(node["card_spend_monthly"]),
        } for node in c360["ecosystem"]],
        "oportunidades_detectadas": [{
            "tipo": o["type_label"], "titulo": o["title"], "score": f"{o['score']}/100",
            "valor_estimado": brl(o["estimated_value"]), "resumo": o["summary"],
            "evidencias": [e["text"] for e in o["evidence"]],
            "composicao_do_score": [f"{f['label']}: {number(f['points'], 1)} de {f['max_points']} pontos ({f['detail']})"
                                    for f in o["score_breakdown"]],
            "acao_sugerida_ao_analista": o["recommended_action"],
        } for o in c360["opportunities"]],
        "mudancas_de_comportamento_no_ultimo_trimestre": [
            {"titulo": s["title"], "descricao": s["description"]} for s in c360["signals"]
        ],
    }
    if c360["anomaly"]["is_anomaly"]:
        facts["comportamento_atipico_detectado"] = c360["anomaly"]["reasons"]
    return facts


def facts_used(c360: dict) -> list[str]:
    items = [f"Saúde financeira {c360['health']['score']}/100",
             f"{c360['metrics']['institutions_count']} instituições conectadas"]
    items += [f"{o['type_label']} {o['score']}/100" for o in c360["opportunities"][:3]]
    if c360["signals"]:
        items.append(f"{len(c360['signals'])} mudança(s) de comportamento")
    return items


# -- LLM ---------------------------------------------------------------------------------------

_client: anthropic.Anthropic | None = None
_client_lock = threading.Lock()


def _llm_client() -> anthropic.Anthropic:
    global _client
    settings = get_settings()
    if not settings.anthropic_api_key:
        raise AIUnavailable("ANTHROPIC_API_KEY não configurada")
    with _client_lock:
        if _client is None:
            _client = anthropic.Anthropic(api_key=settings.anthropic_api_key,
                                          timeout=settings.ai_timeout_seconds, max_retries=1)
    return _client


def _call_llm(content: list[dict]) -> tuple[str, str]:
    settings = get_settings()
    client = _llm_client()
    kwargs: dict = {
        "model": settings.ai_model,
        "max_tokens": 16000,
        "system": SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": content}],
    }
    if not settings.ai_model.startswith("claude-haiku"):
        kwargs["output_config"] = {"effort": settings.ai_effort}
    try:
        if settings.ai_model in FALLBACK_MODELS:
            # If a safety classifier declines, the API retries on Anthropic's recommended fallback model.
            response = client.beta.messages.create(betas=["server-side-fallback-2026-07-01"], fallbacks="default", **kwargs)
        else:
            response = client.messages.create(**kwargs)
    except anthropic.AuthenticationError as exc:
        raise AIUnavailable("chave de API inválida") from exc
    except anthropic.RateLimitError as exc:
        raise AIUnavailable("limite de requisições atingido") from exc
    except anthropic.APIStatusError as exc:
        raise AIUnavailable(f"erro da API ({exc.status_code})") from exc
    except anthropic.APIConnectionError as exc:
        raise AIUnavailable("falha de conexão com a API") from exc
    if response.stop_reason == "refusal":
        raise AIUnavailable("solicitação recusada pelo modelo")
    text = "".join(block.text for block in response.content if block.type == "text").strip()
    if not text:
        raise AIUnavailable("resposta vazia")
    return text, response.model


def _facts_block(facts: dict, cache: bool = False) -> dict:
    block = {"type": "text",
             "text": "FICHA DE FATOS (JSON):\n" + json.dumps(facts, ensure_ascii=False, sort_keys=True, indent=1)}
    if cache:
        # Several questions about the same customer reuse this prefix.
        block["cache_control"] = {"type": "ephemeral"}
    return block


# -- templates (deterministic writer) -------------------------------------------------------------


def _sentence(text: str) -> str:
    text = text.strip()
    return text if text.endswith(".") else text + "."


def _lower_first(text: str) -> str:
    return text[:1].lower() + text[1:] if text and not text[:2].isupper() and not text[:1].isdigit() else text


def template_summary(c360: dict) -> str:
    m, health = c360["metrics"], c360["health"]
    avg = c360["cash_flow"]["average_6m"]
    surplus = avg["income"] - avg["expenses"] - avg["debt_payments"]
    if m["total_debt"] <= 0:
        debt_text = " e nenhuma dívida ativa nas instituições conectadas."
    elif m["expensive_debt"] > 0:
        debt_text = (f"; {pct(m['debt_service_ratio'])} da renda está comprometida com parcelas e há "
                     f"{brl(m['expensive_debt'])} em dívidas caras (acima de 3% a.m.).")
    else:
        debt_text = (f", e {DEBT_LEVEL_TEXT.get(m['debt_level'], '')} ({pct(m['debt_service_ratio'])} da renda "
                     "comprometida com parcelas).")
    parts = [
        f"Nos últimos seis meses, o cliente teve renda média de {brl(avg['income'])} e gastos de {brl(avg['expenses'])} por mês, "
        + (f"com sobra média de {brl(surplus)} após as parcelas" if surplus >= 0
           else f"com déficit médio de {brl(-surplus)} após as parcelas")
        + debt_text
    ]
    externals = [n for n in c360["ecosystem"] if not n["institution"]["is_primary"]]
    externals.sort(key=lambda n: -(n["account_balance"] + n["investment_balance"]))
    share = m["external_asset_share"]
    text = f"O patrimônio de {brl(m['total_assets'])} está distribuído em {m['institutions_count']} instituições"
    if share > 0.5 and externals:
        text += f", e {pct(share)} dele fica fora do banco principal, principalmente no {externals[0]['institution']['short_name']}."
    elif share > 0.1:
        text += f", com {pct(share)} fora do banco principal."
    else:
        text += ", concentrado no banco principal."
    parts.append(text)

    opportunities = c360["opportunities"]
    if opportunities:
        top = opportunities[0]
        reasons = "; ".join(_lower_first(e["text"].rstrip(".")) for e in top["evidence"][:2] if e["kind"] == "support")
        parts.append(f"A principal oportunidade detectada é “{top['title']}” (score {top['score']}/100): {reasons}.")
    if c360["signals"]:
        parts.append("No último trimestre, destacam-se: " + "; ".join(_lower_first(s["title"]) for s in c360["signals"][:3]) + ".")
    comps = sorted(health["components"], key=lambda c: -c["score"])
    weak = [c for c in comps if c["score"] < 45]
    parts.append(
        f"A saúde financeira é {health['score']}/100 ({health['band_label'].lower()}), sustentada por "
        f"{comps[0]['label'].lower()} e {comps[1]['label'].lower()}"
        + (f", com atenção a {weak[-1]['label'].lower()}." if weak else ".")
    )
    if opportunities:
        parts.append(CLOSINGS[opportunities[0]["type"]])
    return " ".join(parts)


def explain_opportunity(opp: dict) -> str:
    """Plain-language explanation of how a score was built (used on the opportunity page)."""
    factors = sorted(opp["score_breakdown"], key=lambda f: -f["points"])
    parts = ", ".join(f"{f['label'].lower()} ({number(f['points'], 1)} de {f['max_points']} pontos — {_lower_first(f['detail'])})"
                      for f in factors if f["points"] > 0)
    support = [e["text"].rstrip(".") for e in opp["evidence"] if e["kind"] == "support"][:2]
    text = f"O score {opp['score']}/100 é a soma de fatores medidos nos dados do cliente: {parts}."
    if support:
        text += " As evidências mais fortes são: " + "; ".join(_lower_first(s) for s in support) + "."
    return text + " A decisão sobre a abordagem é do analista."


_normalize = normalize_text


INTENTS: list[tuple[str, tuple[str, ...]]] = [
    ("score", ("score", "pontua", "nota ", "por que", "porque", "motivo", "oportunidade")),
    ("health", ("saude", "health")),
    ("changes", ("mudan", "comportament", "sinal", "sinais", "trimestre", "evasao")),
    ("debt", ("divida", "juros", "emprestimo", "credito", "financiamento")),
    ("invest", ("investim", "aplica", "carteira")),
    ("spending", ("gasto", "cartao", "consumo", "despesa")),
    ("where", ("onde", "institui", "banco", "distribu", "recurso", "dinheiro", "patrimonio")),
]


def template_answer(question: str, c360: dict) -> str:
    q = _normalize(question)
    intent = next((name for name, keys in INTENTS if any(k in q for k in keys)), "summary")
    m, opps = c360["metrics"], c360["opportunities"]

    if intent == "score" and opps:
        target = next((o for o in opps if str(o["score"]) in q), None) or \
            next((o for o in opps if _normalize(o["type_label"]) in q), None) or opps[0]
        return f"Sobre “{target['title']}” ({target['type_label']}): " + explain_opportunity(target)
    if intent == "health":
        comps = "; ".join(f"{c['label']} {round(c['score'])}/100 ({c['display']})" for c in c360["health"]["components"])
        return (f"A saúde financeira é {c360['health']['score']}/100 ({c360['health']['band_label'].lower()}). "
                f"Componentes: {comps}.")
    if intent == "changes":
        if not c360["signals"]:
            return "Nenhuma mudança relevante de comportamento foi detectada no último trimestre para este cliente."
        return "Mudanças detectadas no último trimestre: " + " ".join(_sentence(s["description"]) for s in c360["signals"])
    if intent == "debt":
        holders = [n for n in c360["ecosystem"] if n["debt_balance"] > 0]
        if not holders:
            return "O cliente não possui operações de crédito ativas nas instituições conectadas."
        detail = ", ".join(f"{brl(n['debt_balance'])} no {n['institution']['short_name']}" for n in holders)
        text = (f"O cliente tem {brl(m['total_debt'])} em dívidas ({detail}), comprometendo {pct(m['debt_service_ratio'])} "
                f"da renda com parcelas. Dívidas caras (acima de 3% a.m.): {brl(m['expensive_debt'])}.")
        debt_opp = next((o for o in opps if o["type"] in ("debt_optimization", "credit")), None)
        return text + (f" Oportunidade relacionada: {debt_opp['summary']}" if debt_opp else "")
    if intent == "invest":
        holders = [n for n in c360["ecosystem"] if n["investment_balance"] > 0]
        if not holders:
            return "O cliente não possui investimentos nas instituições conectadas."
        detail = ", ".join(f"{brl(n['investment_balance'])} no {n['institution']['short_name']}" for n in holders)
        return f"A carteira de investimentos soma {brl(m['total_investments'])}: {detail}."
    if intent == "spending":
        issuers = [n for n in c360["ecosystem"] if n["card_spend_monthly"] > 0]
        detail = ", ".join(f"{brl(n['card_spend_monthly'])} no {n['institution']['short_name']}" for n in issuers)
        return (f"O gasto médio mensal é de {brl(m['monthly_expenses'])}. {pct(m['card_external_share'])} dos gastos com "
                f"cartão ocorrem fora do banco principal" + (f" (fatura do último mês: {detail})." if detail else "."))
    if intent == "where":
        detail = "; ".join(
            f"{n['institution']['short_name']}: " + ", ".join(
                x for x in (f"saldo {brl(n['account_balance'])}" if n["account_balance"] > 0 else "",
                            f"investimentos {brl(n['investment_balance'])}" if n["investment_balance"] > 0 else "",
                            f"dívidas {brl(n['debt_balance'])}" if n["debt_balance"] > 0 else "") if x
            ) for n in c360["ecosystem"]
        )
        return (f"Os recursos estão em {m['institutions_count']} instituições ({pct(m['external_asset_share'])} do "
                f"patrimônio fora do banco principal). {detail}.")
    return template_summary(c360) + (" Posso detalhar o score, a saúde financeira, a distribuição por instituição, "
                                     "as dívidas, os investimentos, os gastos ou as mudanças de comportamento.")


# -- public API --------------------------------------------------------------------------------------

_summary_cache: OrderedDict[tuple, dict] = OrderedDict()
_cache_lock = threading.Lock()


def generate_summary(c360: dict, cache_key: tuple) -> dict:
    with _cache_lock:
        if cache_key in _summary_cache:
            _summary_cache.move_to_end(cache_key)
            return _summary_cache[cache_key]
    facts = build_fact_sheet(c360)
    now = dt.datetime.now().replace(microsecond=0)
    try:
        text, model = _call_llm([_facts_block(facts), {"type": "text", "text": SUMMARY_TASK}])
        result = {"summary": text, "source": "llm", "model": model, "notice": None}
    except AIUnavailable as exc:
        if get_settings().anthropic_api_key:
            logger.warning("Resumo por IA indisponível (%s); usando template.", exc)
        notice = None if not get_settings().anthropic_api_key else f"IA generativa indisponível ({exc}); texto gerado por template."
        result = {"summary": template_summary(c360), "source": "template", "model": None, "notice": notice}
    result.update(generated_at=now, facts_used=facts_used(c360), disclaimer=DISCLAIMER)
    with _cache_lock:
        _summary_cache[cache_key] = result
        while len(_summary_cache) > 500:
            _summary_cache.popitem(last=False)
    return result


def answer_question(question: str, c360: dict) -> dict:
    facts = build_fact_sheet(c360)
    try:
        text, model = _call_llm([
            _facts_block(facts, cache=True),
            {"type": "text", "text": f"Pergunta do analista: {question}\n\nResponda em até 5 frases, usando apenas a ficha."},
        ])
        result = {"answer": text, "source": "llm", "model": model, "notice": None}
    except AIUnavailable as exc:
        notice = None if not get_settings().anthropic_api_key else f"IA generativa indisponível ({exc}); resposta gerada por template."
        result = {"answer": template_answer(question, c360), "source": "template", "model": None, "notice": notice}
    return {"question": question, **result, "facts_used": facts_used(c360)}


def ai_status() -> dict:
    settings = get_settings()
    return {
        "enabled": settings.ai_enabled,
        "provider": "Anthropic" if settings.ai_enabled else None,
        "model": settings.ai_model if settings.ai_enabled else None,
        "mode": "llm" if settings.ai_enabled else "template",
        "guardrails": [
            "A IA recebe apenas fatos já calculados pelos motores (sem transações, nome ou identificadores).",
            "Proibido inventar números, instituições ou intenções; valores copiados da ficha de fatos.",
            "Sem recomendações de aprovação, negação ou alteração de crédito, limites ou bloqueios.",
            "Sem chave de API, um redator determinístico gera o texto a partir dos mesmos fatos.",
            "Cada resposta indica a fonte (LLM ou template) e os fatos utilizados.",
        ],
        "opportunity_types": {k: v["label"] for k, v in ref.OPPORTUNITY_TYPES.items()},
    }
