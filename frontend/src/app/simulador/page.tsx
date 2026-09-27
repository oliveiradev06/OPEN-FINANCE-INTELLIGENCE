"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Copy, Info, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { AreaTrend } from "@/components/charts/AreaTrend";
import { BarList } from "@/components/charts/BarList";
import { Avatar } from "@/components/ui/Avatar";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FilterSelect, SearchInput } from "@/components/ui/FilterSelect";
import { OpportunityPill } from "@/components/ui/OpportunityTag";
import { PageHeader } from "@/components/ui/PageHeader";
import { ScoreBadge } from "@/components/ui/ScoreExplain";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { Tabs } from "@/components/ui/Tabs";
import { api } from "@/lib/api";
import { brl, brlCompact, num, pct, rate } from "@/lib/format";
import { useMeta } from "@/lib/hooks";
import { useRole } from "@/lib/role";
import type { Customer360, OpportunityDetail, OpportunityType, SimulationAssumptions } from "@/lib/types";
import { cn } from "@/lib/utils";

type SimTab = "portabilidade" | "divida" | "investimentos" | "saldo";

const TYPE_TO_TAB: Partial<Record<OpportunityType, SimTab>> = {
  credit: "portabilidade",
  debt_optimization: "divida",
  investment: "investimentos",
  idle_cash: "saldo",
};

/** Fixed installment (Price table) for a monthly rate in %. */
function pmt(ratePct: number, months: number, pv: number) {
  const r = ratePct / 100;
  if (months <= 0 || pv <= 0) return 0;
  if (r === 0) return pv / months;
  return (pv * r) / (1 - Math.pow(1 + r, -months));
}

function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/* ---------- small form + result pieces ---------- */

function Field({ label, value, hint, children }: { label: string; value?: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-[13.5px] font-semibold text-ink">{label}</span>
        {value !== undefined && <span className="tnum text-[14px] font-bold text-[#0a1440]">{value}</span>}
      </div>
      {children}
      {hint && <p className="mt-1 text-[12px] text-ink-3">{hint}</p>}
    </div>
  );
}

function Range({ value, onChange, min, max, step }: { value: number; onChange: (v: number) => void; min: number; max: number; step: number }) {
  return (
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-2 w-full cursor-pointer accent-primary"
    />
  );
}

function NumberInput({ value, onChange, step = 100, prefix, suffix, min = 0 }: { value: number; onChange: (v: number) => void; step?: number; prefix?: string; suffix?: string; min?: number }) {
  return (
    <div className="flex h-10 items-center rounded-lg border border-line-strong bg-white px-3 focus-within:border-primary/60 focus-within:ring-3 focus-within:ring-primary/10">
      {prefix && <span className="mr-2 text-[13px] text-ink-3">{prefix}</span>}
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        step={step}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value)))}
        className="tnum w-full bg-transparent text-[14px] text-ink outline-none"
      />
      {suffix && <span className="ml-2 text-[13px] whitespace-nowrap text-ink-3">{suffix}</span>}
    </div>
  );
}

function ResultTile({ label, value, strong, tone = "ink" }: { label: string; value: string; strong?: boolean; tone?: "ink" | "good" | "bad" }) {
  return (
    <div className={cn("rounded-xl p-4", strong ? "bg-accent-soft/80" : "bg-surface-2")}>
      <div className="text-[12.5px] text-ink-3">{label}</div>
      <div
        className={cn(
          "tnum mt-1 font-bold",
          strong ? "text-[24px]" : "text-[18px]",
          tone === "good" ? "text-accent-ink" : tone === "bad" ? "text-critical" : "text-[#0a1440]",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function Assumptions({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 space-y-1.5 border-t border-line pt-4 text-[12.5px] text-ink-3">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <Info className="mt-0.5 size-3.5 shrink-0" /> {item}
        </li>
      ))}
    </ul>
  );
}

function Summary({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Card>
      <CardHeader
        title="Resumo da proposta"
        subtitle="Texto para registrar no atendimento; a simulação informa o analista e não aprova crédito"
        actions={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              navigator.clipboard?.writeText(text).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              });
            }}
          >
            {copied ? <Check className="size-3.5 text-accent" /> : <Copy className="size-3.5" />} {copied ? "Copiado" : "Copiar resumo"}
          </Button>
        }
      />
      <p className="mx-5 mb-5 rounded-lg bg-surface-2 p-4 text-[13.5px] leading-relaxed text-ink">{text}</p>
    </Card>
  );
}

function SimLayout({ inputs, results, summary }: { inputs: React.ReactNode; results: React.ReactNode; summary: string }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Card>
          <CardHeader title="Parâmetros" subtitle="Valores preenchidos com os dados do cliente; ajuste para comparar cenários" />
          <div className="space-y-5 px-5 pb-5">{inputs}</div>
        </Card>
        <Card>
          <CardHeader title="Resultado" />
          <div className="px-5 pb-5">{results}</div>
        </Card>
      </div>
      <Summary text={summary} />
    </div>
  );
}

/* ---------- simulations ---------- */

function PortabilitySim({ data, preset }: { data: Customer360; preset?: string }) {
  const eligible = data.products.loans.filter((l) => !l.institution.is_primary && l.reference_rate !== null && l.remaining_months);
  const [loanId, setLoanId] = useState(preset && eligible.some((l) => l.loan_id === preset) ? preset : eligible[0]?.loan_id ?? "");
  if (eligible.length === 0) {
    return (
      <Card>
        <EmptyState
          title="Nenhum contrato elegível para portabilidade"
          description="A portabilidade compara contratos de outras instituições com a taxa de referência do banco na mesma modalidade (pessoal, consignado, veículo ou imobiliário)."
        />
      </Card>
    );
  }
  const loan = eligible.find((l) => l.loan_id === loanId) ?? eligible[0];
  return (
    <PortabilityForm
      key={loan.loan_id}
      loan={loan}
      options={eligible.map((l) => ({ value: l.loan_id, label: `${l.label} · ${l.institution.short_name} · ${brl(l.balance)}` }))}
      onLoan={setLoanId}
    />
  );
}

function PortabilityForm({
  loan,
  options,
  onLoan,
}: {
  loan: Customer360["products"]["loans"][number];
  options: { value: string; label: string }[];
  onLoan: (id: string) => void;
}) {
  const [balance, setBalance] = useState(Math.round(loan.balance));
  const [months, setMonths] = useState(loan.remaining_months ?? 12);
  const [current, setCurrent] = useState(loan.interest_rate);
  const [proposed, setProposed] = useState(loan.reference_rate ?? loan.interest_rate);
  const currentPmt = pmt(current, months, balance);
  const newPmt = pmt(proposed, months, balance);
  const monthly = currentPmt - newPmt;
  const total = monthly * months;
  const summary =
    `Portabilidade de ${loan.label.toLowerCase()} do ${loan.institution.name}: saldo de ${brl(balance)} em ${months} parcelas. ` +
    `Taxa de ${rate(current)} para ${rate(proposed)}; parcela de ${brl(currentPmt)} para ${brl(newPmt)}, ` +
    `economia de ${brl(monthly)} por mês e ${brl(total)} no prazo. Sujeito à análise de crédito e à política vigente.`;
  return (
    <SimLayout
      summary={summary}
      inputs={
        <>
          <Field label="Contrato">
            <FilterSelect label="Contrato" value={loan.loan_id} onChange={onLoan} options={options} required />
          </Field>
          <Field label="Saldo devedor">
            <NumberInput value={balance} onChange={setBalance} prefix="R$" step={500} />
          </Field>
          <Field label="Prazo restante" value={`${months} meses`}>
            <Range value={months} onChange={setMonths} min={1} max={Math.max(360, loan.remaining_months ?? 0)} step={1} />
          </Field>
          <Field label="Taxa atual" value={rate(current)} hint="Informada pela instituição via Open Finance">
            <Range value={current} onChange={setCurrent} min={0.5} max={Math.max(8, loan.interest_rate + 1)} step={0.01} />
          </Field>
          <Field label="Taxa proposta pelo banco" value={rate(proposed)} hint={`Referência para ${loan.label.toLowerCase()}: ${rate(loan.reference_rate ?? proposed)}`}>
            <Range value={proposed} onChange={setProposed} min={0.3} max={Math.max(current, loan.reference_rate ?? 0) + 0.5} step={0.01} />
          </Field>
        </>
      }
      results={
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <ResultTile label="Parcela atual (recalculada)" value={brl(currentPmt)} />
            <ResultTile label="Nova parcela" value={brl(newPmt)} tone="good" />
            <ResultTile label="Economia por mês" value={brl(monthly)} tone={monthly >= 0 ? "good" : "bad"} />
            <ResultTile label={`Economia em ${months} meses`} value={brl(total)} strong tone={total >= 0 ? "good" : "bad"} />
          </div>
          <div className="mt-5">
            <BarList
              color="#eb6834"
              highlightColor="#2a78d6"
              items={[
                { key: "atual", label: "Custo total no contrato atual", value: currentPmt * months, display: brlCompact(currentPmt * months) },
                { key: "novo", label: "Custo total com a proposta", value: newPmt * months, display: brlCompact(newPmt * months), highlight: true },
              ]}
            />
          </div>
          <Assumptions
            items={[
              "Parcelas fixas pela tabela Price, calculadas com a mesma fórmula nos dois cenários.",
              `Parcela informada hoje pela instituição: ${brl(loan.installment)}.`,
              "A proposta final depende de análise de crédito; a plataforma não aprova operações.",
            ]}
          />
        </>
      }
    />
  );
}

function DebtSim({ data, sim }: { data: Customer360; sim: SimulationAssumptions }) {
  const expensive = data.products.loans.filter((l) => l.expensive);
  const buffer = 0.5 * data.metrics.monthly_expenses;
  const available = Math.max(0, data.metrics.total_balance - buffer);
  const [selected, setSelected] = useState<string[]>(expensive.map((l) => l.loan_id));
  const chosen = expensive.filter((l) => selected.includes(l.loan_id));
  const debt = chosen.reduce((sum, l) => sum + l.balance, 0);
  const weighted = debt ? chosen.reduce((sum, l) => sum + l.balance * l.interest_rate, 0) / debt : 0;
  const maxAmount = Math.round(Math.min(debt, available));
  const [amountRaw, setAmount] = useState(maxAmount);
  const amount = Math.min(amountRaw, maxAmount);
  if (expensive.length === 0) {
    return (
      <Card>
        <EmptyState
          title="Nenhuma dívida cara"
          description={`Dívidas acima de ${rate(sim.expensive_debt_rate)} (rotativo, cheque especial, crédito pessoal caro) aparecem aqui.`}
        />
      </Card>
    );
  }
  const avoided = (amount * weighted * 12) / 100;
  const lost = amount * sim.cdi_monthly * 12;
  const net = avoided - lost;
  const summary =
    `Amortização de ${brl(amount)} em dívidas a ${rate(weighted)} usando o saldo em conta, preservando ${brl(buffer)} de reserva. ` +
    `Em 12 meses o cliente evita ${brl(avoided)} de juros e deixa de render ${brl(lost)}: economia líquida de ${brl(net)}. ` +
    `Dívida restante: ${brl(debt - amount)}. Qualquer nova concessão segue a política vigente.`;
  return (
    <SimLayout
      summary={summary}
      inputs={
        <>
          <Field label="Dívidas consideradas" hint={`Acima de ${rate(sim.expensive_debt_rate)}`}>
            <div className="space-y-2">
              {expensive.map((l) => (
                <label key={l.loan_id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-[13.5px] hover:bg-surface-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(l.loan_id)}
                    onChange={() => setSelected((ids) => (ids.includes(l.loan_id) ? ids.filter((id) => id !== l.loan_id) : [...ids, l.loan_id]))}
                    className="size-4 accent-primary"
                  />
                  <span className="min-w-0 flex-1 text-ink">
                    {l.label} · {l.institution.short_name}
                  </span>
                  <span className="tnum text-ink-2">{rate(l.interest_rate)}</span>
                  <span className="tnum w-24 text-right font-semibold text-ink">{brl(l.balance)}</span>
                </label>
              ))}
            </div>
          </Field>
          <Field label="Valor a amortizar" value={brl(amount)} hint={`Saldo disponível após a reserva: ${brl(available)}`}>
            <Range value={amount} onChange={setAmount} min={0} max={Math.max(maxAmount, 1)} step={100} />
          </Field>
        </>
      }
      results={
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <ResultTile label="Juros evitados em 12 meses" value={brl(avoided)} tone="good" />
            <ResultTile label="Rendimento que o saldo deixaria de ter" value={brl(lost)} />
            <ResultTile label="Economia líquida em 12 meses" value={brl(net)} strong tone={net >= 0 ? "good" : "bad"} />
            <ResultTile label="Dívida cara restante" value={brl(debt - amount)} />
          </div>
          <div className="mt-5">
            <BarList
              color="#8491a6"
              highlightColor="#0f9d68"
              items={[
                { key: "juros", label: "Juros evitados", value: avoided, display: brl(avoided), highlight: true },
                { key: "rendimento", label: "Rendimento perdido", value: lost, display: brl(lost) },
              ]}
            />
          </div>
          <Assumptions
            items={[
              `Reserva preservada: meia despesa mensal (${brl(buffer)}), como no motor de oportunidades.`,
              `Rendimento do saldo: ${pct(sim.cdi_monthly, 2)} ao mês (cerca de 100% do CDI).`,
              "Cálculo simples em 12 meses, sem reinvestimento dos juros evitados.",
            ]}
          />
        </>
      }
    />
  );
}

function YieldSim({
  kind,
  data,
  sim,
  baseAmount,
  primaryInvestments,
  externalInvestments,
}: {
  kind: "investimentos" | "saldo";
  data: Customer360;
  sim: SimulationAssumptions;
  baseAmount: number;
  primaryInvestments: number;
  externalInvestments: number;
}) {
  const products = sim.investment_products.filter((p) => (kind === "saldo" ? ["diaria", "d+1"].includes(p.liquidity) : p.type !== "previdencia"));
  const [productType, setProductType] = useState(products[0]?.type ?? "cdb");
  const [amountRaw, setAmount] = useState(Math.round(baseAmount));
  const [months, setMonths] = useState(12);
  const product = products.find((p) => p.type === productType) ?? products[0];
  const amount = Math.min(amountRaw, Math.round(baseAmount));
  const y = product?.monthly_yield ?? 0;
  const projected = amount * Math.pow(1 + y, months);
  const gain = projected - amount;
  const series = Array.from({ length: months + 1 }, (_, m) => ({ label: m === 0 ? "Hoje" : `${m}º mês`, value: amount * Math.pow(1 + y, m) }));
  const totalInv = primaryInvestments + externalInvestments;
  const shareBefore = totalInv ? primaryInvestments / totalInv : 0;
  const shareAfter = totalInv ? (primaryInvestments + amount) / totalInv : 0;
  const summary =
    kind === "investimentos"
      ? `Trazer ${brl(amount)} investidos em outras instituições para ${product?.label} no banco. Em ${months} meses, projeção de ${brl(projected)} ` +
        `(rendimento de ${brl(gain)}). A participação do banco na carteira de investimentos do cliente passaria de ${pct(shareBefore)} para ${pct(shareAfter)}.`
      : `Aplicar ${brl(amount)} parados em conta em ${product?.label} (liquidez ${product?.liquidity}). Em ${months} meses, rendimento estimado de ${brl(gain)} ` +
        `(${brl(gain / months)} por mês em média), mantendo a reserva operacional em conta.`;
  return (
    <SimLayout
      summary={summary}
      inputs={
        <>
          <Field
            label={kind === "investimentos" ? "Valor a trazer para o banco" : "Valor a aplicar"}
            value={brl(amount)}
            hint={kind === "investimentos" ? `Investido hoje em outras instituições: ${brl(externalInvestments)}` : `Saldo ocioso identificado: ${brl(baseAmount)}`}
          >
            <Range value={amount} onChange={setAmount} min={0} max={Math.max(Math.round(baseAmount), 1)} step={100} />
          </Field>
          <Field label="Produto do banco">
            <FilterSelect
              label="Produto"
              required
              value={product?.type ?? ""}
              onChange={setProductType}
              options={products.map((p) => ({ value: p.type, label: `${p.label} · ${pct(p.monthly_yield, 2)} a.m. · liquidez ${p.liquidity}` }))}
            />
          </Field>
          <Field label="Prazo" value={`${months} meses`}>
            <Range value={months} onChange={setMonths} min={1} max={36} step={1} />
          </Field>
        </>
      }
      results={
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <ResultTile label={`Valor projetado em ${months} meses`} value={brl(projected)} />
            <ResultTile label="Rendimento no período" value={brl(gain)} strong tone="good" />
            {kind === "investimentos" ? (
              <>
                <ResultTile label="Captação para o banco" value={brl(amount)} />
                <ResultTile label="Participação do banco nos investimentos" value={`${pct(shareBefore)} → ${pct(shareAfter)}`} tone="good" />
              </>
            ) : (
              <>
                <ResultTile label="Rendimento médio por mês" value={brl(gain / months)} />
                <ResultTile label="Continua em conta corrente" value={brl(Math.max(0, data.metrics.total_balance - amount))} />
              </>
            )}
          </div>
          <div className="mt-5">
            <AreaTrend id={`sim-${kind}`} name="Saldo projetado" color="#0f9d68" data={series} height={180} />
          </div>
          <Assumptions
            items={[
              `Rendimento de referência de ${product?.label}: ${pct(y, 2)} ao mês, valor do ambiente sintético (não é oferta).`,
              `Risco ${product?.risk} · liquidez ${product?.liquidity}. Juros compostos mensais, sem impostos.`,
              "A recomendação de produto segue o perfil de investidor (suitability) do cliente.",
            ]}
          />
        </>
      }
    />
  );
}

/* ---------- customer selection ---------- */

function CustomerPicker({ onPick }: { onPick: (id: string) => void }) {
  const role = useRole();
  const [query, setQuery] = useState("");
  const term = useDebounced(query.trim());
  const hits = useQuery({ queryKey: ["search", term, role], queryFn: () => api.searchCustomers(term), enabled: term.length >= 2 });
  const suggestions = useQuery({ queryKey: ["priority", role], queryFn: () => api.priorityCustomers(5) });
  const rows = term.length >= 2 ? (hits.data ?? []).map((h) => ({ id: h.customer_id, name: h.name, sub: `${h.customer_id} · ${h.segment}`, score: h.opportunity_score })) : (suggestions.data ?? []).map((p) => ({ id: p.customer_id, name: p.name, sub: `${p.customer_id} · ${p.opportunity_label}`, score: p.opportunity_score }));
  return (
    <Card>
      <CardHeader title="Escolha o cliente" subtitle="A simulação usa os contratos, investimentos e saldos que o cliente compartilhou via Open Finance" />
      <div className="px-5 pb-5">
        <SearchInput value={query} onChange={setQuery} placeholder="Buscar por nome ou ID do cliente…" label="Buscar cliente" />
        <div className="mt-4 text-[12px] font-semibold tracking-[0.08em] text-ink-3 uppercase">{term.length >= 2 ? "Resultados" : "Sugestões · clientes prioritários"}</div>
        <ul className="mt-2 divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => onPick(r.id)} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-surface-2">
                <Avatar name={r.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-ink">{r.name}</span>
                  <span className="block text-[12px] text-ink-3">{r.sub}</span>
                </span>
                {r.score > 0 && <ScoreBadge score={r.score} size="sm" />}
                <ArrowRight className="size-4 text-ink-3" />
              </button>
            </li>
          ))}
          {term.length >= 2 && hits.data?.length === 0 && <li className="py-3 text-[13px] text-ink-3">Nenhum cliente encontrado.</li>}
        </ul>
      </div>
    </Card>
  );
}

/* ---------- page ---------- */

export default function SimulatorPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[70vh] rounded-xl" />}>
      <SimulatorView />
    </Suspense>
  );
}

function SimulatorView() {
  const role = useRole();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { data: meta } = useMeta();
  const opportunityId = params.get("opportunity");
  const opportunity = useQuery({ queryKey: ["opportunity", opportunityId, role], queryFn: () => api.opportunity(opportunityId!), enabled: !!opportunityId });
  const customerId = params.get("customer") ?? opportunity.data?.customer_id ?? null;
  const customer = useQuery({ queryKey: ["customer", customerId, role], queryFn: () => api.customer(customerId!), enabled: !!customerId });

  const setParams = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Simulador"
        description="Monte uma proposta com os números reais do cliente e as taxas de referência do banco. A simulação informa o analista; não aprova crédito."
      />
      {!customerId ? (
        <CustomerPicker onPick={(id) => setParams({ customer: id, opportunity: null, sim: null })} />
      ) : customer.error || opportunity.error ? (
        <ErrorState error={customer.error ?? opportunity.error} />
      ) : !customer.data || !meta || (opportunityId && !opportunity.data) ? (
        <Skeleton className="h-[60vh] rounded-xl" />
      ) : (
        <Workspace
          data={customer.data}
          sim={meta.simulation}
          opportunity={opportunity.data}
          requested={params.get("sim") as SimTab | null}
          onTab={(sim) => setParams({ sim })}
          onClear={() => router.replace(pathname, { scroll: false })}
        />
      )}
    </div>
  );
}

function Workspace({
  data,
  sim,
  opportunity,
  requested,
  onTab,
  onClear,
}: {
  data: Customer360;
  sim: SimulationAssumptions;
  opportunity?: OpportunityDetail;
  requested: SimTab | null;
  onTab: (tab: SimTab) => void;
  onClear: () => void;
}) {
  const primaryInvestments = data.ecosystem.filter((n) => n.institution.is_primary).reduce((sum, n) => sum + n.investment_balance, 0);
  const externalInvestments = data.ecosystem.filter((n) => !n.institution.is_primary).reduce((sum, n) => sum + n.investment_balance, 0);
  const primaryBalance = data.ecosystem.filter((n) => n.institution.is_primary).reduce((sum, n) => sum + n.account_balance, 0);
  const idleOpportunity = data.opportunities.find((o) => o.type === "idle_cash");
  const idle = idleOpportunity?.estimated_value ?? Math.max(0, primaryBalance - Math.max(0.5 * data.metrics.monthly_expenses, 2000));

  const availability = useMemo<Record<SimTab, string>>(() => {
    const eligible = data.products.loans.filter((l) => !l.institution.is_primary && l.reference_rate !== null && l.remaining_months).length;
    const expensive = data.products.loans.filter((l) => l.expensive).reduce((sum, l) => sum + l.balance, 0);
    return {
      portabilidade: eligible ? `${eligible} contrato${eligible > 1 ? "s" : ""}` : "sem contratos",
      divida: expensive ? brlCompact(expensive) : "sem dívida cara",
      investimentos: externalInvestments ? brlCompact(externalInvestments) : "sem investimentos fora",
      saldo: idle > 0 ? brlCompact(idle) : "sem saldo ocioso",
    };
  }, [data, externalInvestments, idle]);

  const fallback: SimTab = data.products.loans.some((l) => !l.institution.is_primary && l.reference_rate !== null && l.remaining_months)
    ? "portabilidade"
    : data.products.loans.some((l) => l.expensive)
      ? "divida"
      : externalInvestments > 0
        ? "investimentos"
        : "saldo";
  const tab: SimTab = requested ?? (opportunity ? TYPE_TO_TAB[opportunity.type] : undefined) ?? fallback;
  const presetLoan =
    opportunity?.type === "credit"
      ? data.products.loans.find((l) => (opportunity.context as { loans?: { name: string; label: string }[] }).loans?.some((x) => x.label === l.label && x.name === l.institution.name))?.loan_id
      : undefined;

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-4 p-4">
        <Avatar name={data.customer.name} size="lg" variant="light" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[17px] font-bold text-ink">{data.customer.name}</span>
            {data.opportunities[0] && <ScoreBadge score={data.opportunities[0].score} size="sm" />}
          </div>
          <div className="text-[13px] text-ink-2">
            {data.customer.customer_id} · {data.customer.segment} · renda {brl(data.metrics.monthly_income)} · {num(data.metrics.institutions_count)} instituições
          </div>
          {opportunity && (
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3">
              A partir da oportunidade <OpportunityPill type={opportunity.type} size="sm" />
              <Link href={`/oportunidades/${opportunity.opportunity_id}`} className="font-semibold text-primary-ink hover:underline">
                {opportunity.title}
              </Link>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <ButtonLink variant="secondary" href={`/clientes/${data.customer.customer_id}`}>
            Abrir Customer 360
          </ButtonLink>
          <Button variant="ghost" onClick={onClear}>
            <Search className="size-4" /> Trocar cliente
          </Button>
        </div>
      </Card>

      <Tabs
        value={tab}
        onChange={onTab}
        items={[
          { value: "portabilidade", label: `Portabilidade de crédito · ${availability.portabilidade}` },
          { value: "divida", label: `Quitação de dívida cara · ${availability.divida}` },
          { value: "investimentos", label: `Investimentos · ${availability.investimentos}` },
          { value: "saldo", label: `Saldo parado · ${availability.saldo}` },
        ]}
      />

      {tab === "portabilidade" && <PortabilitySim key={data.customer.customer_id} data={data} preset={presetLoan} />}
      {tab === "divida" && <DebtSim key={data.customer.customer_id} data={data} sim={sim} />}
      {tab === "investimentos" &&
        (externalInvestments > 0 ? (
          <YieldSim
            key={`${data.customer.customer_id}-inv`}
            kind="investimentos"
            data={data}
            sim={sim}
            baseAmount={externalInvestments}
            primaryInvestments={primaryInvestments}
            externalInvestments={externalInvestments}
          />
        ) : (
          <Card>
            <EmptyState title="Sem investimentos em outras instituições" description="Todos os investimentos do cliente já estão no banco principal." />
          </Card>
        ))}
      {tab === "saldo" &&
        (idle > 0 ? (
          <YieldSim
            key={`${data.customer.customer_id}-idle`}
            kind="saldo"
            data={data}
            sim={sim}
            baseAmount={idle}
            primaryInvestments={primaryInvestments}
            externalInvestments={externalInvestments}
          />
        ) : (
          <Card>
            <EmptyState title="Sem saldo ocioso relevante" description="O saldo em conta do cliente está próximo da reserva operacional (meia despesa mensal)." />
          </Card>
        ))}
    </div>
  );
}
