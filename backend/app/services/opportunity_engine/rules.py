"""The seven opportunity rules. Thresholds live in ``params`` and are exposed to the UI."""

from __future__ import annotations

from app.core.formatting import brl, number, pct, rate
from app.data import reference as ref
from app.data.generator import pmt
from app.services.opportunity_engine.base import (
    Candidate,
    Evidence,
    Factor,
    Metric,
    Rule,
    institution_name,
    join_names,
    log_scale,
    money,
    nice_floor,
    scale,
)

PRIMARY = ref.PRIMARY_INSTITUTION_ID
CDI_MONTHLY_YIELD = 0.0085  # yield forgone when cash is used to pay debt (~100% CDI)


def _external(ctx: dict, field: str) -> list[dict]:
    rows = [r for r in ctx.get("institutions", []) if r["institution_id"] != PRIMARY and r[field] > 0]
    return sorted(rows, key=lambda r: r[field], reverse=True)


class IdleCashRule(Rule):
    rule_id = "IDLE_CASH_V1"
    type = "idle_cash"
    name = "Saldo parado"
    description = ("Saldo de fim de mês no banco principal acima do mínimo, estável por pelo menos 5 dos últimos 6 meses "
                   "e pouco movimentado. Valor ocioso = saldo médio menos meia movimentação mensal de folga. "
                   "Não se aplica a clientes com dívida cara (quitar a dívida é o melhor uso do saldo).")
    params = {"min_avg_balance": 15000, "max_balance_cv": 0.2, "min_stable_months": 5,
              "buffer_months": 0.5, "min_idle_amount": 8000, "max_turnover": 0.8, "max_expensive_debt": 2000}

    def evaluate(self, f: dict, ctx: dict) -> Candidate | None:
        p = self.params
        avg = f["balance_primary_avg_6m"]
        cv = f["balance_primary_cv_6m"]
        stable = int(f["months_balance_stable"])
        if avg < p["min_avg_balance"] or cv > p["max_balance_cv"] or stable < p["min_stable_months"]:
            return None
        if f["expensive_debt"] >= p["max_expensive_debt"]:
            return None
        outflows = f["outflows_primary_avg_6m"]
        buffer = max(p["buffer_months"] * outflows, 2000.0)
        idle = avg - buffer
        turnover = f["turnover_primary"]
        if idle < p["min_idle_amount"] or turnover > p["max_turnover"]:
            return None

        floor = nice_floor(f["balance_primary_min_6m"])
        dsr = f["debt_service_ratio"]
        months_income = int(f["months_with_income"])
        factors = [
            Factor("idle_amount", "Valor ocioso", 35, log_scale(idle, 5000, 80000), f"{brl(idle)} acima da folga operacional"),
            Factor("stability", "Estabilidade do saldo", 25, stable / 6 * (1 - 0.5 * scale(cv, 0.03, 0.2)),
                   f"{stable}/6 meses acima de 80% da média · variação de {pct(cv)}"),
            Factor("low_usage", "Baixa utilização do saldo", 15, scale(0.8 - turnover, 0, 0.7),
                   f"Movimentação mensal equivale a {pct(turnover)} do saldo"),
            Factor("recurring_income", "Renda recorrente", 15, months_income / 12 * (1 - 0.6 * scale(f["income_cv"], 0.05, 0.3)),
                   f"{months_income}/12 meses com renda regular"),
            Factor("low_debt", "Baixo endividamento", 10, 1 - scale(dsr, 0.05, 0.35), f"Parcelas = {pct(dsr)} da renda"),
        ]
        evidence = [
            Evidence(f"Saldo permaneceu acima de {money(floor)} por 6 meses." if floor > 0 else
                     f"Saldo médio de {brl(avg)} nos últimos 6 meses."),
            Evidence(f"Baixa utilização do saldo: a movimentação mensal ({brl(outflows)}) equivale a {pct(turnover)} do saldo médio."),
            Evidence(f"Renda recorrente: {months_income} de 12 meses com crédito de renda"
                     + (" no banco principal." if f["salary_at_primary"] else ".")),
        ]
        if dsr < 0.15:
            evidence.append(Evidence(f"Baixo nível de dívida: parcelas comprometem {pct(dsr)} da renda."))
        else:
            evidence.append(Evidence(f"Parcelas comprometem {pct(dsr)} da renda — considerar na abordagem.", "caution"))
        if f["investments_total"] > 1000:
            evidence.append(Evidence(
                f"Cliente já possui {brl(f['investments_total'])} investidos — perfil investidor conhecido.", "context"
            ))
        return Candidate(
            type=self.type,
            estimated_value=round(idle, 2),
            summary=f"{money(idle)} parados em conta corrente há 6 meses, acima da reserva operacional.",
            factors=factors,
            evidence=evidence,
            metrics=[
                Metric("idle_amount", "Valor identificado", round(idle, 2)),
                Metric("avg_balance", "Saldo médio últimos 6 meses", round(avg, 2)),
                Metric("monthly_outflows", "Movimentação mensal", round(outflows, 2)),
                Metric("buffer", "Reserva operacional sugerida", round(buffer, 2)),
            ],
            recommended_action=(f"Apresentar alternativas com liquidez diária (CDB DI, fundos DI) para o excedente de "
                                f"{brl(idle)}, preservando {brl(buffer)} em conta para a movimentação do mês."),
            context={"threshold": floor, "buffer": round(buffer, 2), "avg_balance": round(avg, 2)},
        )


class InvestmentRule(Rule):
    rule_id = "INVESTMENT_V1"
    type = "investment"
    name = "Investimentos em outras instituições"
    description = "Investimentos em outras instituições acima do mínimo e representando a maior parte da carteira do cliente."
    params = {"min_external": 20000, "min_external_share": 0.6}

    def evaluate(self, f: dict, ctx: dict) -> Candidate | None:
        p = self.params
        external = f["investments_external"]
        share = f["external_investment_share"]
        if external < p["min_external"] or share < p["min_external_share"]:
            return None
        internal = f["investments_primary"]
        holders = _external(ctx, "investment_balance")
        names = [institution_name(r["institution_id"]) for r in holders[:2]]
        external_types = sorted({ref.INVESTMENT_TYPES[i["investment_type"]]["label"]
                                 for i in ctx.get("investments", []) if i["institution_id"] != PRIMARY})
        dsr = f["debt_service_ratio"]
        tenure = f["tenure_years"]
        surplus = f["surplus_avg_6m"]
        factors = [
            Factor("external_volume", "Volume investido fora", 30, log_scale(external, 15000, 250000),
                   f"{brl(external)} em outras instituições"),
            Factor("external_concentration", "Concentração externa", 25, scale(share, 0.6, 0.97),
                   f"{pct(share)} da carteira fora do banco"),
            Factor("income_stability", "Estabilidade de renda", 15, 1 - scale(f["income_cv"], 0.05, 0.35),
                   f"{int(f['months_with_income'])}/12 meses com renda · variação de {pct(f['income_cv'])}"),
            Factor("low_debt", "Baixo endividamento", 10, 1 - scale(dsr, 0.05, 0.4), f"Parcelas = {pct(dsr)} da renda"),
            Factor("tenure", "Tempo de relacionamento", 10, scale(tenure, 0.5, 6), f"{number(tenure, 1)} anos de relacionamento"),
            Factor("cash_flow", "Saldo mensal positivo", 10, scale(f["surplus_ratio"], 0, 0.15), f"Sobra média de {brl(surplus)}/mês"),
        ]
        evidence = [
            Evidence(f"{brl(external)} investidos em {join_names(names)} ({pct(share)} da carteira de investimentos)."),
            Evidence(f"Apenas {brl(internal)} investidos no banco principal." if internal > 0
                     else "Nenhum investimento no banco principal."),
        ]
        if f["income_cv"] < 0.12:
            evidence.append(Evidence(f"Renda estável há {int(f['months_with_income'])} meses."))
        if dsr < 0.15:
            evidence.append(Evidence(f"Baixo endividamento: parcelas comprometem {pct(dsr)} da renda."))
        evidence.append(Evidence(f"Relacionamento com o banco há {int(tenure)} anos." if tenure >= 1
                                 else "Cliente recente (menos de 1 ano de relacionamento).", "context" if tenure < 3 else "support"))
        if surplus > 0:
            evidence.append(Evidence(f"Saldo mensal positivo (média de {brl(surplus)} após despesas e parcelas)."))
        if external_types:
            evidence.append(Evidence(f"Produtos externos: {join_names(external_types)}.", "context"))
        return Candidate(
            type=self.type,
            estimated_value=round(external, 2),
            summary=(f"{money(external)} investidos fora do banco ({pct(share)} da carteira), principalmente em "
                     f"{names[0] if names else 'outras instituições'}."),
            factors=factors,
            evidence=evidence,
            metrics=[
                Metric("internal", "Investido no banco principal", round(internal, 2)),
                Metric("external", "Investido em outras instituições", round(external, 2)),
                Metric("external_share", "Concentração externa", round(share, 4), "percent"),
                Metric("main_holder", "Principal instituição externa", names[0] if names else "—", "text"),
            ],
            recommended_action=("Oferecer assessoria de investimentos e comparar rentabilidade e liquidez dos produtos atuais"
                                + (f" ({join_names(external_types).lower()})" if external_types else "")
                                + " com a prateleira do banco; avaliar portabilidade de custódia."),
            context={
                "internal": round(internal, 2), "external": round(external, 2),
                "by_institution": [{"institution_id": r["institution_id"], "name": institution_name(r["institution_id"]),
                                    "value": round(r["investment_balance"], 2)} for r in holders],
            },
        )


class DebtOptimizationRule(Rule):
    rule_id = "DEBT_OPTIMIZATION_V1"
    type = "debt_optimization"
    name = "Dívida cara com saldo disponível"
    description = ("Dívidas acima de 3% a.m. enquanto o cliente mantém saldo em conta (descontada meia despesa mensal "
                   "de reserva) suficiente para cobrir parte relevante delas.")
    params = {"expensive_rate": ref.EXPENSIVE_DEBT_RATE, "min_expensive_debt": 2000, "min_coverage": 0.5, "buffer_months": 0.5}

    def evaluate(self, f: dict, ctx: dict) -> Candidate | None:
        p = self.params
        debt = f["expensive_debt"]
        if debt < p["min_expensive_debt"]:
            return None
        buffer = p["buffer_months"] * f["expenses_avg_6m"]
        available = f["liquid_total"] - buffer
        coverage = available / debt
        if coverage < p["min_coverage"]:
            return None
        payable = min(debt, available)
        monthly_interest = f["expensive_debt_interest"]
        avg_rate = f["expensive_debt_rate"]
        savings_12m = max(payable * (avg_rate / 100 - CDI_MONTHLY_YIELD) * 12, 0.0)
        loans = sorted([ln for ln in ctx.get("loans", []) if ln["interest_rate"] >= p["expensive_rate"]],
                       key=lambda ln: ln["balance"], reverse=True)
        factors = [
            Factor("interest_cost", "Custo da dívida cara", 35, log_scale(monthly_interest * 12, 1200, 25000),
                   f"{brl(monthly_interest)} de juros por mês"),
            Factor("coverage", "Cobertura por saldo disponível", 25, scale(coverage, 0.5, 2.5),
                   f"Saldo disponível cobre {pct(coverage)} da dívida"),
            Factor("rate_gap", "Diferença de taxa", 20, scale(avg_rate, 3, 8), f"{rate(avg_rate)} pagos vs. ~0,85% a.m. de rendimento"),
            Factor("savings", "Economia potencial", 20, log_scale(savings_12m, 500, 15000), f"{brl(savings_12m)} em 12 meses"),
        ]
        evidence = [
            Evidence(f"{brl(ln['balance'])} em {ref.LOAN_TYPES[ln['loan_type']]['label'].lower()} no "
                     f"{institution_name(ln['institution_id'])} a {rate(ln['interest_rate'])}.")
            for ln in loans[:3]
        ]
        evidence += [
            Evidence(f"{brl(available)} disponíveis em conta após reservar {brl(buffer)} para o mês."),
            Evidence(f"Custo estimado de juros: {brl(monthly_interest)}/mês ({brl(monthly_interest * 12)} em 12 meses)."),
            Evidence(f"O saldo disponível cobre {pct(coverage)} da dívida cara."),
            Evidence("Recomenda-se preservar uma reserva de emergência ao amortizar.", "caution"),
        ]
        return Candidate(
            type=self.type,
            estimated_value=round(payable, 2),
            summary=f"{money(debt)} em dívida cara a {rate(avg_rate)} enquanto {money(available)} estão disponíveis em conta.",
            factors=factors,
            evidence=evidence,
            metrics=[
                Metric("expensive_debt", "Dívida cara", round(debt, 2)),
                Metric("available", "Saldo disponível", round(available, 2)),
                Metric("monthly_interest", "Juros mensais", round(monthly_interest, 2)),
                Metric("savings_12m", "Economia estimada (12 meses)", round(savings_12m, 2)),
            ],
            recommended_action=("Orientar o cliente sobre amortização ou quitação da dívida cara com o saldo disponível; se preferir "
                                "manter a reserva, avaliar consolidação em linha mais barata. Qualquer concessão de crédito segue a "
                                "política vigente e análise humana."),
            context={
                "debt": round(debt, 2), "available": round(available, 2), "savings_12m": round(savings_12m, 2),
                "loans": [{"institution_id": ln["institution_id"], "name": institution_name(ln["institution_id"]),
                           "loan_type": ln["loan_type"], "label": ref.LOAN_TYPES[ln["loan_type"]]["label"],
                           "balance": round(ln["balance"], 2), "rate": ln["interest_rate"]} for ln in loans],
            },
        )


class CreditPortabilityRule(Rule):
    rule_id = "CREDIT_PORTABILITY_V1"
    type = "credit"
    name = "Portabilidade de crédito"
    description = ("Operações de crédito em outras instituições com taxa acima da taxa de referência do banco para a mesma "
                   "modalidade, com saldo e prazo remanescente relevantes. Apenas informa — não aprova crédito.")
    params = {"min_spread": 0.3, "min_balance": 5000, "min_remaining_months": 6}

    def evaluate(self, f: dict, ctx: dict) -> Candidate | None:
        p = self.params
        eligible = []
        for ln in ctx.get("loans", []):
            reference_rate = ref.PRIMARY_REFERENCE_RATES.get(ln["loan_type"])
            remaining = ln["remaining_months"]
            if (ln["institution_id"] == PRIMARY or reference_rate is None or remaining is None or remaining != remaining):
                continue
            spread = ln["interest_rate"] - reference_rate
            if spread >= p["min_spread"] and ln["balance"] >= p["min_balance"] and remaining >= p["min_remaining_months"]:
                new_installment = pmt(reference_rate, int(remaining), ln["balance"])
                savings = max((ln["installment"] - new_installment) * remaining, 0.0)
                eligible.append({**ln, "reference_rate": reference_rate, "spread": spread, "savings": savings})
        if not eligible:
            return None
        total = sum(ln["balance"] for ln in eligible)
        savings = sum(ln["savings"] for ln in eligible)
        wspread = sum(ln["spread"] * ln["balance"] for ln in eligible) / total
        relative_spread = sum(ln["spread"] / ln["reference_rate"] * ln["balance"] for ln in eligible) / total
        wrate = sum(ln["interest_rate"] * ln["balance"] for ln in eligible) / total
        wref = sum(ln["reference_rate"] * ln["balance"] for ln in eligible) / total
        dsr = f["debt_service_ratio"]
        factors = [
            Factor("rate_spread", "Diferença de taxa", 35, scale(relative_spread, 0.1, 0.6),
                   f"{number(wspread, 2)} p.p. ({pct(relative_spread)}) acima da referência"),
            Factor("balance", "Saldo portável", 25, log_scale(total, 5000, 100000), f"{brl(total)} em contratos elegíveis"),
            Factor("customer_savings", "Economia para o cliente", 25, log_scale(savings, 1000, 25000), f"{brl(savings)} no prazo restante"),
            Factor("capacity", "Comprometimento de renda", 15, 1 - scale(dsr, 0.15, 0.5), f"Parcelas = {pct(dsr)} da renda"),
        ]
        evidence = []
        for ln in sorted(eligible, key=lambda x: x["balance"], reverse=True):
            label = ref.LOAN_TYPES[ln["loan_type"]]["label"]
            evidence.append(Evidence(
                f"{label} no {institution_name(ln['institution_id'])}: saldo de {brl(ln['balance'])} a {rate(ln['interest_rate'])} "
                f"({int(ln['remaining_months'])} parcelas restantes); referência do banco: {rate(ln['reference_rate'])}."
            ))
        evidence.append(Evidence(f"Economia estimada para o cliente: {brl(savings)} no prazo restante."))
        evidence.append(Evidence(
            "A portabilidade depende de análise de crédito e da política vigente — nenhuma aprovação automática.", "caution"
        ))
        labels = sorted({ref.LOAN_TYPES[ln["loan_type"]]["label"].lower() for ln in eligible})
        insts = sorted({institution_name(ln["institution_id"]) for ln in eligible})
        return Candidate(
            type=self.type,
            estimated_value=round(total, 2),
            summary=f"{money(total)} em {join_names(labels)} no {join_names(insts)} com taxa acima da referência do banco.",
            factors=factors,
            evidence=evidence,
            metrics=[
                Metric("portable_balance", "Saldo portável", round(total, 2)),
                Metric("current_rate", "Taxa atual (média)", round(wrate, 2), "rate"),
                Metric("reference_rate", "Taxa de referência", round(wref, 2), "rate"),
                Metric("savings", "Economia estimada", round(savings, 2)),
            ],
            recommended_action=("Avaliar proposta de portabilidade de crédito com a taxa de referência. A decisão segue a "
                                "política de crédito vigente e a análise do analista."),
            context={"loans": [{"institution_id": ln["institution_id"], "name": institution_name(ln["institution_id"]),
                                "loan_type": ln["loan_type"], "label": ref.LOAN_TYPES[ln["loan_type"]]["label"],
                                "balance": round(ln["balance"], 2), "rate": ln["interest_rate"],
                                "reference_rate": ln["reference_rate"], "remaining_months": int(ln["remaining_months"]),
                                "savings": round(ln["savings"], 2)} for ln in eligible]},
        )


class SpendingMigrationRule(Rule):
    rule_id = "SPENDING_MIGRATION_V1"
    type = "spending_migration"
    name = "Gastos em cartões concorrentes"
    description = "A maior parte dos gastos com cartão (média do último trimestre) ocorre em cartões de outras instituições."
    params = {"min_card_spend": 1500, "min_external_share": 0.6}

    def evaluate(self, f: dict, ctx: dict) -> Candidate | None:
        p = self.params
        total = f["card_spend_total_3m"]
        share = f["card_external_share_3m"]
        if total < p["min_card_spend"] or share < p["min_external_share"]:
            return None
        external = f["card_spend_external_3m"]
        internal = f["card_spend_primary_3m"]
        previous = f["card_external_share_prev3m"]
        trend = share - previous
        issuers = _external(ctx, "card_spend_monthly")
        names = [institution_name(r["institution_id"]) for r in issuers[:2]]
        factors = [
            Factor("external_share", "Participação externa", 40, scale(share, 0.5, 0.95),
                   f"{pct(share)} dos gastos com cartão fora do banco"),
            Factor("external_volume", "Volume em cartões concorrentes", 25, log_scale(external, 800, 10000), f"{brl(external)} por mês"),
            Factor("trend", "Tendência", 20, scale(trend, 0, 0.2) if trend > 0.02 else 0.15,
                   f"{'+' if trend >= 0 else ''}{number(trend * 100, 0)} p.p. no último trimestre"),
            Factor("anchor", "Vínculo com o banco principal", 15, 1.0 if f["salary_at_primary"] else 0.4,
                   "Salário creditado no banco principal" if f["salary_at_primary"] else "Conta ativa no banco principal"),
        ]
        evidence = [
            Evidence(f"{pct(share)} dos gastos com cartão ocorrem fora do banco principal ({join_names(names)})."),
            Evidence(f"{brl(external)} por mês em cartões concorrentes, contra {brl(internal)} no cartão do banco."),
        ]
        if trend >= 0.05:
            evidence.append(Evidence(f"A participação externa subiu de {pct(previous)} para {pct(share)} no último trimestre."))
        if f["salary_at_primary"]:
            evidence.append(Evidence("Cliente recebe salário no banco principal."))
        if not f["has_primary_card"]:
            evidence.append(Evidence("Cliente não possui cartão de crédito do banco principal.", "context"))
        return Candidate(
            type=self.type,
            estimated_value=round(external * 12, 2),
            summary="A maior parte dos gastos do cliente ocorre fora da instituição principal "
                    f"({pct(share)} em {join_names(names) or 'cartões concorrentes'}).",
            factors=factors,
            evidence=evidence,
            metrics=[
                Metric("primary_share", "Cartão banco principal", round(1 - share, 4), "percent"),
                Metric("external_share", "Cartão concorrente", round(share, 4), "percent"),
                Metric("external_monthly", "Gasto mensal em concorrentes", round(external, 2)),
                Metric("external_annual", "Volume anual em concorrentes", round(external * 12, 2)),
            ],
            recommended_action=("Apresentar o cartão do banco com benefícios alinhados ao padrão de gastos do cliente"
                                + (" (sem cartão atual no banco)." if not f["has_primary_card"]
                                   else " e revisar limite e programa de pontos.")),
            context={
                "primary_share": round(1 - share, 4), "external_share": round(share, 4), "previous_external_share": round(previous, 4),
                "by_institution": [{"institution_id": r["institution_id"], "name": institution_name(r["institution_id"]),
                                    "value": round(r["card_spend_monthly"], 2)} for r in issuers],
            },
        )


class RelationshipRule(Rule):
    rule_id = "RELATIONSHIP_V1"
    type = "relationship"
    name = "Relacionamento fragmentado"
    description = ("Cliente recebe salário no banco principal, mas ao menos 2 das categorias investimentos, cartão e crédito "
                   "estão majoritariamente (60%+) em outras instituições.")
    params = {"min_external_categories": 2, "dominance": 0.6, "min_income": 3000}

    def evaluate(self, f: dict, ctx: dict) -> Candidate | None:
        p = self.params
        if not f["salary_at_primary"] or f["income_avg_6m"] < p["min_income"]:
            return None
        loans_total = f["loans_primary"] + f["loans_external"]
        categories = {
            "investimentos": (f["investments_total"] > 1000, f["external_investment_share"], "investment_balance"),
            "cartao": (f["card_spend_total_3m"] > 300, f["card_external_share_3m"], "card_spend_monthly"),
            "emprestimo": (loans_total > 1000, f["loans_external"] / loans_total if loans_total else 0.0, "debt_balance"),
        }
        external = {k: v for k, v in categories.items() if v[0] and v[1] >= p["dominance"]}
        if len(external) < p["min_external_categories"]:
            return None
        ext_share = f["external_asset_share"]
        tenure = f["tenure_years"]
        factors = [
            Factor("fragmentation", "Produtos fora do banco", 40, len(external) / 3, f"{len(external)} de 3 categorias concentradas fora"),
            Factor("external_assets", "Patrimônio externo", 25, scale(ext_share, 0.3, 0.9),
                   f"{pct(ext_share)} do patrimônio em outras instituições"),
            Factor("income", "Potencial de renda", 20, scale(f["income_avg_6m"], 3000, 25000), f"Renda média de {brl(f['income_avg_6m'])}"),
            Factor("tenure", "Tempo de relacionamento", 15, scale(tenure, 1, 12), f"{number(tenure, 1)} anos de relacionamento"),
        ]
        labels = {"investimentos": "Investimentos", "cartao": "Cartão", "emprestimo": "Empréstimo"}
        evidence = [Evidence(f"Salário creditado no banco principal ({int(f['months_salary_at_primary'])} dos últimos 12 meses).")]
        mapping = []
        for key, (present, share, field) in categories.items():
            holders = _external(ctx, field)
            main = institution_name(holders[0]["institution_id"]) if holders else "—"
            if key in external:
                amount = holders[0][field] if holders else 0
                detail = f"{pct(share)} dos gastos" if key == "cartao" else brl(amount)
                evidence.append(Evidence(f"{labels[key]} → {main} ({detail})."))
            mapping.append({"category": key, "label": labels[key], "present": bool(present),
                            "external_share": round(float(share), 4), "main_external": main if holders else None})
        evidence.append(Evidence(f"{pct(ext_share)} do patrimônio está fora do banco.", "context"))
        external_assets = f["balance_external_last"] + f["investments_external"]
        return Candidate(
            type=self.type,
            estimated_value=round(external_assets, 2),
            summary=(f"Salário no banco principal, mas {join_names([labels[k].lower() for k in external])} "
                     "concentrados em outras instituições."),
            factors=factors,
            evidence=evidence,
            metrics=[
                Metric("external_categories", "Categorias fora do banco", f"{len(external)} de 3", "text"),
                Metric("external_assets", "Patrimônio em outras instituições", round(external_assets, 2)),
                Metric("external_asset_share", "Participação externa do patrimônio", round(ext_share, 4), "percent"),
                Metric("institutions", "Instituições conectadas", int(f["institutions_count"]), "number"),
            ],
            recommended_action=("Abordagem consultiva de relacionamento: apresentar uma oferta integrada (investimentos, cartão e "
                                "crédito) com condições de cliente com salário no banco."),
            context={"map": [{"category": "salario", "label": "Salário", "present": True, "external_share": 0.0,
                              "main_external": None}, *mapping]},
        )


class RetentionRule(Rule):
    rule_id = "RETENTION_V1"
    type = "retention"
    name = "Risco de evasão"
    description = ("Combinação de sinais do último trimestre: portabilidade de salário, queda de saldo, resgate de "
                   "investimentos e aumento de uso de concorrentes no lugar do banco principal.")
    params = {"min_score": 35, "min_balance_drop": 0.15, "min_investment_outflow": 0.15}

    def evaluate(self, f: dict, ctx: dict) -> Candidate | None:
        p = self.params
        moved = bool(f["salary_changed"]) and f["salary_institution_prev"] == PRIMARY
        balance_drop = -f["balance_primary_change"] if f["balance_primary_avg_prev3m"] >= 3000 else 0.0
        invest_out = -f["investments_primary_change"] if f["investments_primary_prev3m"] >= 5000 else 0.0
        share_delta = f["card_external_share_3m"] - f["card_external_share_prev3m"]
        factors = [
            Factor("salary_move", "Portabilidade de salário", 35, 1.0 if moved else 0.0,
                   f"Salário migrou para {institution_name(f['salary_institution'])}" if moved else "Salário mantido"),
            Factor("balance_drop", "Queda de saldo", 25, scale(balance_drop, p["min_balance_drop"], 0.5),
                   f"Saldo médio {pct(-balance_drop, signed=True)} no trimestre"),
            Factor("investment_outflow", "Saída de investimentos", 25, scale(invest_out, p["min_investment_outflow"], 0.7),
                   f"Investimentos no banco {pct(-invest_out, signed=True)}"),
            Factor("competitor_usage", "Uso de concorrentes", 15, scale(share_delta, 0.05, 0.3),
                   f"{'+' if share_delta >= 0 else ''}{number(share_delta * 100, 0)} p.p. em cartões concorrentes"),
        ]
        candidate_score = sum(fc.points for fc in factors)
        if candidate_score < p["min_score"] and not moved:
            return None
        evidence = []
        if moved:
            month = f["salary_change_month"]
            evidence.append(Evidence(f"O crédito de salário migrou do banco principal para o {institution_name(f['salary_institution'])}"
                                     + (f" a partir de {month[5:7]}/{month[:4]}." if month else ".")))
        if balance_drop >= p["min_balance_drop"]:
            evidence.append(Evidence(f"Saldo no banco principal caiu {pct(balance_drop)} no último trimestre "
                                     f"({brl(f['balance_primary_avg_prev3m'])} → {brl(f['balance_primary_avg_3m'])})."))
        if invest_out >= p["min_investment_outflow"]:
            moved_value = f["investments_primary_prev3m"] - f["investments_primary"]
            evidence.append(Evidence(f"{brl(moved_value)} resgatados de investimentos no banco principal ({pct(-invest_out)})."))
            if f["investments_external_change"] > 0.2:
                evidence.append(Evidence(
                    f"No mesmo período, investimentos em outras instituições cresceram {pct(f['investments_external_change'])}."
                ))
        if share_delta >= 0.05:
            evidence.append(Evidence(f"Participação de cartões concorrentes subiu de {pct(f['card_external_share_prev3m'])} "
                                     f"para {pct(f['card_external_share_3m'])} dos gastos."))
        at_risk = f["balance_primary_avg_prev3m"] + f["investments_primary_prev3m"]
        signals = [fc.label.lower() for fc in factors if fc.points > 0]
        return Candidate(
            type=self.type,
            estimated_value=round(at_risk, 2),
            summary=f"Sinais de evasão no último trimestre: {join_names(signals)}.",
            factors=factors,
            evidence=evidence,
            metrics=[
                Metric("at_risk", "Recursos em risco", round(at_risk, 2)),
                Metric("balance_change", "Variação do saldo", round(-balance_drop, 4), "percent"),
                Metric("investment_change", "Variação dos investimentos", round(-invest_out, 4), "percent"),
                Metric("salary_institution", "Instituição de salário atual", institution_name(f["salary_institution"]), "text"),
            ],
            recommended_action=("Contato prioritário do gerente para entender a mudança e apresentar proposta de retenção "
                                "(condições de conta, investimentos e crédito)."),
            context={"moved_salary": moved, "balance_drop": round(balance_drop, 4), "investment_outflow": round(invest_out, 4),
                     "card_share_delta": round(share_delta, 4)},
        )


def default_rules() -> list[Rule]:
    return [
        InvestmentRule(), IdleCashRule(), DebtOptimizationRule(), CreditPortabilityRule(),
        RelationshipRule(), RetentionRule(), SpendingMigrationRule(),
    ]
