"use client";

import { ArrowRight, PiggyBank } from "lucide-react";
import Link from "next/link";
import { AreaTrend } from "@/components/charts/AreaTrend";
import { PrimaryVsExternal } from "@/components/charts/PrimaryVsExternal";
import { ShareBar } from "@/components/charts/ShareBar";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { InstitutionAvatar } from "@/components/ui/InstitutionAvatar";
import { Meter } from "@/components/ui/Meter";
import { StatTile } from "@/components/ui/StatTile";
import { EmptyState } from "@/components/ui/States";
import { brl, brlCompact, dateBR, monthLabel, pct, rate } from "@/lib/format";
import { DEBT_LEVEL_META } from "@/lib/labels";
import type { Customer360, InstitutionRef } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CashFlowTrend, CashFlowWaterfall } from "./CashFlow";

function InstitutionCell({ institution, onOpen }: { institution: InstitutionRef; onOpen: (id: string) => void }) {
  return (
    <button type="button" onClick={() => onOpen(institution.institution_id)} className="flex items-center gap-2.5 text-left hover:text-primary-ink">
      <InstitutionAvatar institution={institution} size="md" />
      <span className="font-semibold whitespace-nowrap text-ink">{institution.short_name}</span>
      {institution.is_primary && (
        <Badge tone="green" size="sm">
          Banco principal
        </Badge>
      )}
    </button>
  );
}

function Table({ head, children, minWidth = 720 }: { head: React.ReactNode[]; children: React.ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto px-5 pb-4">
      <table className="w-full text-left text-[13.5px]" style={{ minWidth }}>
        <thead>
          <tr className="bg-surface-2 text-[12.5px] text-ink-2">
            {head.map((h, i) => (
              <th key={i} className={cn("px-3 py-2.5 font-medium", i === 0 && "rounded-l-lg pl-4", i === head.length - 1 && "rounded-r-lg pr-4 text-right")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

const td = "border-b border-line px-3 py-3 group-last:border-0";

export function AccountsTab({ data, onOpen }: { data: Customer360; onOpen: (id: string) => void }) {
  const { accounts, cards } = data.products;
  const card = data.relationship_map.find((r) => r.category === "cartao");
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Card>
          <CardHeader title="Fluxo de caixa" subtitle="Para onde vai cada real da renda" />
          <div className="px-5 pb-5">
            <CashFlowWaterfall lastMonth={data.cash_flow.last_month} average={data.cash_flow.average_6m} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Renda e gastos mês a mês" subtitle="Últimos 12 meses, todas as instituições" />
          <div className="px-3 pb-4">
            <CashFlowTrend timeline={data.timeline} />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Contas" subtitle={`${accounts.length} conta${accounts.length === 1 ? "" : "s"} em ${new Set(accounts.map((a) => a.institution.institution_id)).size} instituições`} />
        <Table head={["Instituição", "Tipo de conta", "Aberta em", "Saldo médio (6 meses)", "Saldo atual"]}>
          {accounts.map((a) => (
            <tr key={a.account_id} className="group">
              <td className={cn(td, "pl-4")}>
                <InstitutionCell institution={a.institution} onOpen={onOpen} />
              </td>
              <td className={cn(td, "text-ink-2")}>{a.label}</td>
              <td className={cn(td, "tnum text-ink-2")}>{dateBR(a.opened_at)}</td>
              <td className={cn(td, "tnum text-ink-2")}>{brl(a.average_balance)}</td>
              <td className={cn(td, "tnum pr-4 text-right font-semibold text-ink")}>{brl(a.balance)}</td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card>
        <CardHeader
          title="Cartões de crédito"
          subtitle={card && card.primary_share !== null ? `${pct(card.primary_share)} dos gastos com cartão no banco principal` : "Sem gastos com cartão"}
        />
        {card && card.primary_share !== null && (
          <div className="px-5 pb-3">
            <ShareBar primaryShare={card.primary_share} primaryLabel="Cartão do banco" externalLabel="Cartões concorrentes" />
          </div>
        )}
        {cards.length > 0 ? (
          <Table head={["Instituição", "Cartão", "Limite", "Utilização", "Fatura mensal"]}>
            {cards.map((c) => (
              <tr key={c.card_id} className="group">
                <td className={cn(td, "pl-4")}>
                  <InstitutionCell institution={c.institution} onOpen={onOpen} />
                </td>
                <td className={cn(td, "text-ink-2")}>
                  {c.brand} {c.tier}
                </td>
                <td className={cn(td, "tnum text-ink-2")}>{brl(c.credit_limit)}</td>
                <td className={td}>
                  <div className="flex w-40 items-center gap-2">
                    <Meter value={c.utilization} color={c.utilization > 0.8 ? "#d98b06" : "var(--color-primary)"} className="flex-1" />
                    <span className="tnum w-9 text-right text-[12.5px] text-ink-2">{pct(c.utilization)}</span>
                  </div>
                </td>
                <td className={cn(td, "tnum pr-4 text-right font-semibold text-ink")}>{brl(c.monthly_bill)}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState title="Nenhum cartão de crédito" description="O cliente não possui cartões nas instituições conectadas." />
        )}
      </Card>
    </div>
  );
}

function OpportunityLink({ data, type, label }: { data: Customer360; type: string; label: string }) {
  const o = data.opportunities.find((op) => op.type === type);
  if (!o) return null;
  return (
    <Link href={`/oportunidades/${o.opportunity_id}`} className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary-ink hover:underline">
      {label} (score {o.score}) <ArrowRight className="size-3.5" />
    </Link>
  );
}

export function InvestmentsTab({ data, onOpen }: { data: Customer360; onOpen: (id: string) => void }) {
  const investments = data.products.investments.filter((i) => i.investment_type !== "previdencia");
  const total = investments.reduce((sum, i) => sum + i.balance, 0);
  const primary = investments.filter((i) => i.institution.is_primary).reduce((sum, i) => sum + i.balance, 0);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Total investido" value={brl(total)} hint="Fora previdência, todas as instituições" />
        <StatTile label="No banco principal" value={brl(primary)} hint={total ? `${pct(primary / total)} da carteira` : undefined} />
        <StatTile label="Em outras instituições" value={brl(total - primary)} hint={total ? `${pct((total - primary) / total)} da carteira` : undefined} />
      </div>
      <Card>
        <CardHeader title="Carteira de investimentos" actions={<OpportunityLink data={data} type="investment" label="Oportunidade de investimentos" />} />
        {investments.length > 0 ? (
          <Table head={["Instituição", "Produto", "Tipo", "Risco", "Liquidez", "Saldo"]} minWidth={820}>
            {investments.map((i) => (
              <tr key={i.investment_id} className="group">
                <td className={cn(td, "pl-4")}>
                  <InstitutionCell institution={i.institution} onOpen={onOpen} />
                </td>
                <td className={cn(td, "text-ink")}>{i.product_name}</td>
                <td className={cn(td, "text-ink-2")}>{i.label}</td>
                <td className={cn(td, "text-ink-2 capitalize")}>{i.risk_category}</td>
                <td className={cn(td, "text-ink-2")}>{i.liquidity}</td>
                <td className={cn(td, "tnum pr-4 text-right font-semibold text-ink")}>{brl(i.balance)}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState icon={PiggyBank} title="Nenhum investimento" description="O cliente não possui investimentos nas instituições conectadas." />
        )}
      </Card>
      <Card>
        <CardHeader title="Investimentos em 12 meses" subtitle="Banco principal comparado às outras instituições" />
        <div className="px-3 pb-4">
          <PrimaryVsExternal series={data.timeline} primaryKey="investments_primary" externalKey="investments_external" label="Investimentos" />
        </div>
      </Card>
    </div>
  );
}

export function CreditTab({ data, onOpen }: { data: Customer360; onOpen: (id: string) => void }) {
  const { loans } = data.products;
  const m = data.metrics;
  const debt = DEBT_LEVEL_META[m.debt_level];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Dívida total" value={brl(m.total_debt)} />
        <StatTile label="Dívida cara (acima de 3% a.m.)" value={brl(m.expensive_debt)} />
        <StatTile label="Parcelas sobre a renda" value={pct(m.debt_service_ratio)} />
        <StatTile label="Nível de endividamento" value={<Badge tone={debt.tone} className="text-[14px]">{debt.label}</Badge>} />
      </div>
      <Card>
        <CardHeader
          title="Empréstimos e financiamentos"
          subtitle="Taxa de referência do banco para a mesma modalidade, quando existe"
          actions={
            <div className="flex flex-wrap gap-4">
              <OpportunityLink data={data} type="credit" label="Portabilidade" />
              <OpportunityLink data={data} type="debt_optimization" label="Dívida cara" />
            </div>
          }
        />
        {loans.length > 0 ? (
          <Table head={["Instituição", "Modalidade", "Taxa", "Referência do banco", "Parcela", "Prazo restante", "Saldo devedor"]} minWidth={940}>
            {loans.map((l) => (
              <tr key={l.loan_id} className="group">
                <td className={cn(td, "pl-4")}>
                  <InstitutionCell institution={l.institution} onOpen={onOpen} />
                </td>
                <td className={cn(td, "text-ink")}>
                  <span className="flex flex-wrap items-center gap-2">
                    {l.label}
                    {l.expensive && (
                      <Badge tone="red" size="sm">
                        Dívida cara
                      </Badge>
                    )}
                  </span>
                </td>
                <td className={cn(td, "tnum font-semibold text-ink")}>{rate(l.interest_rate)}</td>
                <td className={cn(td, "tnum text-ink-2")}>
                  {l.reference_rate !== null && !l.institution.is_primary ? (
                    <span className={cn(l.interest_rate - l.reference_rate >= 0.3 && "font-semibold text-accent-ink")}>{rate(l.reference_rate)}</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className={cn(td, "tnum text-ink-2")}>{brl(l.installment)}</td>
                <td className={cn(td, "tnum text-ink-2")}>{l.remaining_months ? `${l.remaining_months} meses` : "Rotativo"}</td>
                <td className={cn(td, "tnum pr-4 text-right font-semibold text-ink")}>{brl(l.balance)}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState title="Nenhuma operação de crédito" description="O cliente não possui empréstimos ou financiamentos nas instituições conectadas." />
        )}
      </Card>
      <Card>
        <CardHeader title="Dívida total em 12 meses" subtitle="Saldo devedor somado de todas as instituições" />
        <div className="px-3 pb-4">
          <AreaTrend id="credit-debt" name="Dívida total" color="#e34948" data={data.timeline.map((t) => ({ label: monthLabel(t.month), value: t.debt_total }))} height={220} />
        </div>
      </Card>
    </div>
  );
}

export function PensionTab({ data, onOpen }: { data: Customer360; onOpen: (id: string) => void }) {
  const plans = data.products.investments.filter((i) => i.investment_type === "previdencia");
  const total = plans.reduce((sum, i) => sum + i.balance, 0);
  if (plans.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={PiggyBank}
          title="Sem previdência privada"
          description="O cliente não tem planos PGBL ou VGBL nas instituições conectadas. Planos de previdência aparecem aqui quando compartilhados via Open Finance."
        />
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader title="Planos de previdência" subtitle={`${brl(total)} em ${plans.length} plano${plans.length === 1 ? "" : "s"} · ${brlCompact(total)} do patrimônio`} />
      <Table head={["Instituição", "Plano", "Risco", "Liquidez", "Saldo"]}>
        {plans.map((i) => (
          <tr key={i.investment_id} className="group">
            <td className={cn(td, "pl-4")}>
              <InstitutionCell institution={i.institution} onOpen={onOpen} />
            </td>
            <td className={cn(td, "text-ink")}>{i.product_name}</td>
            <td className={cn(td, "text-ink-2 capitalize")}>{i.risk_category}</td>
            <td className={cn(td, "text-ink-2")}>{i.liquidity}</td>
            <td className={cn(td, "tnum pr-4 text-right font-semibold text-ink")}>{brl(i.balance)}</td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}
