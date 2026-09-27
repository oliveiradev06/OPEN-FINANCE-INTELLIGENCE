"use client";

import { ArrowRight, Scale } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AreaTrend } from "@/components/charts/AreaTrend";
import { BarList } from "@/components/charts/BarList";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { PrimaryVsExternal } from "@/components/charts/PrimaryVsExternal";
import { ShareBar } from "@/components/charts/ShareBar";
import { InstitutionAvatar } from "@/components/ui/InstitutionAvatar";
import { Meter } from "@/components/ui/Meter";
import { brl, brlCompact, monthLabel, pct, rate } from "@/lib/format";
import { useInstitutions } from "@/lib/hooks";
import type { InstitutionRef, OpportunityDetail } from "@/lib/types";

type Ctx = Record<string, unknown>;
type Holder = { institution_id: string; name: string; value: number };

const CURRENT = "#eb6834"; // current rate
const REFERENCE = "#2a78d6"; // bank reference rate

export function Frame({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3">
        <div className="text-[15px] font-semibold text-[#0e1a3a]">{title}</div>
        {subtitle && <div className="text-[12.5px] text-ink-3">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

/** Institution rows with a bar on a light track, share and amount — "Distribuição atual". */
function HolderBars({ rows, institutions }: { rows: Holder[]; institutions: Record<string, InstitutionRef> }) {
  const total = rows.reduce((sum, r) => sum + r.value, 0) || 1;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="divide-y divide-line">
      {rows.map((r) => {
        const inst = institutions[r.institution_id];
        return (
          <li key={r.institution_id} className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_52px_96px] items-center gap-3 py-2.5 text-[13.5px]">
            <span className="flex min-w-0 items-center gap-2.5">
              {inst && <InstitutionAvatar institution={inst} size="sm" />}
              <span className="truncate text-ink">{r.name}</span>
            </span>
            <span className="h-2.5 overflow-hidden rounded-[3px] bg-[#e8eef7]">
              <span
                className="block h-full rounded-[3px]"
                style={{ width: `${Math.max((r.value / max) * 100, 2)}%`, backgroundColor: inst?.is_primary ? "var(--color-accent)" : "#2f80ed" }}
              />
            </span>
            <span className="tnum text-right text-ink-2">{pct(r.value / total)}</span>
            <span className="tnum text-right font-semibold text-ink">{brl(r.value)}</span>
          </li>
        );
      })}
    </ul>
  );
}

function investmentHolders(o: OpportunityDetail, primaryName: string): Holder[] {
  const ctx = o.context as { internal: number; by_institution: Holder[] };
  const rows = [...ctx.by_institution];
  if (ctx.internal > 0) rows.push({ institution_id: "aurora", name: primaryName, value: ctx.internal });
  return rows.sort((a, b) => b.value - a.value);
}

function DebtBlock({ o }: { o: OpportunityDetail }) {
  const ctx = o.context as { debt: number; available: number; savings_12m: number; loans: { name: string; label: string; balance: number; rate: number }[] };
  const coverage = ctx.debt ? ctx.available / ctx.debt : 0;
  return (
    <div className="rounded-xl border border-[#f3dca2] bg-[#fffaf0] p-5">
      <div className="flex items-center gap-2 text-[12.5px] font-semibold tracking-[0.08em] text-[#8a5c00] uppercase">
        <Scale className="size-4" /> Ineficiência financeira detectada
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div className="rounded-lg border border-line bg-white p-4">
          <div className="text-[12.5px] text-ink-3">Dívida cara</div>
          <div className="tnum text-[24px] font-bold text-[#0a1440]">{brl(ctx.debt)}</div>
          <div className="mt-1 space-y-0.5 text-[12.5px] text-ink-2">
            {ctx.loans.map((l) => (
              <div key={`${l.name}-${l.label}`}>
                {l.label} · {l.name} · {rate(l.rate)}
              </div>
            ))}
          </div>
        </div>
        <ArrowRight className="mx-auto hidden size-5 text-ink-3 sm:block" />
        <div className="rounded-lg border border-line bg-white p-4">
          <div className="text-[12.5px] text-ink-3">Saldo disponível</div>
          <div className="tnum text-[24px] font-bold text-[#0a1440]">{brl(ctx.available)}</div>
          <div className="mt-1 text-[12.5px] text-ink-2">após reservar meia despesa mensal</div>
        </div>
      </div>
      <div className="mt-4">
        <div className="mb-1.5 flex justify-between text-[13px]">
          <span className="text-ink-2">Cobertura da dívida pelo saldo disponível</span>
          <span className="tnum font-bold text-ink">{pct(coverage)}</span>
        </div>
        <Meter value={Math.min(coverage, 1)} color="var(--color-primary)" height={8} />
      </div>
      <p className="mt-4 text-[13px] text-ink-2">
        Economia estimada em 12 meses ao amortizar: <span className="font-bold text-ink">{brl(ctx.savings_12m)}</span> (juros evitados menos o
        rendimento de ~0,85% a.m. que o saldo deixaria de ter).
      </p>
    </div>
  );
}

function CreditRates({ o, compact }: { o: OpportunityDetail; compact?: boolean }) {
  const ctx = o.context as { loans: { name: string; label: string; balance: number; rate: number; reference_rate: number; remaining_months: number; savings: number }[] };
  const data = ctx.loans.map((l) => ({ label: `${l.label} · ${l.name}`, "Taxa atual": l.rate, "Referência do banco": l.reference_rate }));
  return (
    <div style={{ height: (compact ? 60 : 70) + ctx.loans.length * 70 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }} barGap={3}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}%`} />
          <YAxis type="category" dataKey="label" width={compact ? 150 : 190} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: "rgb(20 108 236 / 0.05)" }} content={<ChartTooltip valueFormatter={(v) => rate(v)} />} />
          <Legend iconType="rect" iconSize={9} wrapperStyle={{ fontSize: 12, color: "var(--color-ink-2)" }} />
          <Bar dataKey="Taxa atual" fill={CURRENT} radius={[0, 4, 4, 0]} maxBarSize={14} isAnimationActive={false} />
          <Bar dataKey="Referência do banco" fill={REFERENCE} radius={[0, 4, 4, 0]} maxBarSize={14} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function SalaryChips({ o }: { o: OpportunityDetail }) {
  const institutions = useInstitutions();
  return (
    <div className="flex flex-wrap gap-1.5">
      {o.series.map((t) => (
        <div key={t.month} className="rounded-md border border-line bg-white px-2 py-1 text-center">
          <div className="text-[11px] text-ink-3">{monthLabel(t.month)}</div>
          <div className="mt-0.5 flex items-center justify-center gap-1 text-[12px] font-semibold text-ink">
            {t.salary_institution_id && institutions[t.salary_institution_id] ? (
              <>
                <InstitutionAvatar institution={institutions[t.salary_institution_id]} size="xs" />
                {institutions[t.salary_institution_id].short_name}
              </>
            ) : (
              "—"
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function RelationshipRows({ o }: { o: OpportunityDetail }) {
  const ctx = o.context as { map: { category: string; label: string; present: boolean; external_share: number; main_external: string | null }[] };
  return (
    <div className="space-y-4">
      {ctx.map.map((row) => (
        <div key={row.category}>
          <div className="mb-1.5 flex justify-between text-[13px]">
            <span className="font-semibold text-ink">{row.label}</span>
            <span className="text-ink-3">{!row.present ? "Não possui" : row.external_share >= 0.6 ? `→ ${row.main_external ?? "outra instituição"}` : "Banco principal"}</span>
          </div>
          {row.present ? <ShareBar primaryShare={1 - row.external_share} showLegend={false} height={8} /> : <div className="h-2 rounded border border-dashed border-line-strong" />}
        </div>
      ))}
    </div>
  );
}

/** Compact visual for the overview card: the one picture that explains the opportunity. */
export function PrimaryViz({ opportunity: o }: { opportunity: OpportunityDetail }) {
  const institutions = useInstitutions();
  const primaryName = institutions.aurora?.name ?? "Banco principal";
  switch (o.type) {
    case "investment":
      return (
        <Frame title="Distribuição atual dos investimentos" subtitle="Banco principal em verde">
          <HolderBars rows={investmentHolders(o, primaryName)} institutions={institutions} />
        </Frame>
      );
    case "idle_cash": {
      const ctx = o.context as Ctx;
      return (
        <Frame title="Saldo no banco principal" subtitle="Fim de mês · linha tracejada: patamar mantido nos últimos 6 meses">
          <AreaTrend
            id="idle-compact"
            name="Saldo no banco principal"
            data={o.series.map((t) => ({ label: monthLabel(t.month), value: t.balance_primary }))}
            height={230}
            reference={Number(ctx.threshold) > 0 ? { value: Number(ctx.threshold), label: `acima de ${brlCompact(Number(ctx.threshold))}` } : undefined}
          />
        </Frame>
      );
    }
    case "debt_optimization":
      return <DebtBlock o={o} />;
    case "credit":
      return (
        <Frame title="Taxa atual × referência do banco" subtitle="% ao mês, por contrato elegível">
          <CreditRates o={o} compact />
        </Frame>
      );
    case "spending_migration": {
      const ctx = o.context as { primary_share: number; by_institution: Holder[] };
      return (
        <Frame title="Gastos com cartão por instituição" subtitle="Média mensal do último trimestre">
          <ShareBar primaryShare={ctx.primary_share} primaryLabel="Cartão do banco" externalLabel="Cartões concorrentes" />
          {ctx.by_institution.length > 0 && (
            <div className="mt-4">
              <HolderBars rows={ctx.by_institution} institutions={institutions} />
            </div>
          )}
        </Frame>
      );
    }
    case "relationship":
      return (
        <Frame title="Relacionamento por produto" subtitle="Participação do banco principal em cada categoria">
          <RelationshipRows o={o} />
        </Frame>
      );
    case "retention":
      return (
        <Frame title="Instituição que recebeu o salário" subtitle="Mês a mês, últimos 12 meses">
          <SalaryChips o={o} />
          <div className="mt-4">
            <AreaTrend id="ret-compact" name="Saldo no banco principal" data={o.series.map((t) => ({ label: monthLabel(t.month), value: t.balance_primary }))} height={150} />
          </div>
        </Frame>
      );
  }
}

/** Full set of Open Finance charts behind the opportunity (the "Dados do Open Finance" tab). */
export function OpportunityViz({ opportunity: o }: { opportunity: OpportunityDetail }) {
  switch (o.type) {
    case "idle_cash":
      return (
        <div className="grid gap-6 lg:grid-cols-2">
          <PrimaryViz opportunity={o} />
          <Frame title="Renda e gastos" subtitle="Movimentação que define a reserva operacional">
            <AreaTrend id="idle-exp" name="Gastos mensais" color="#eb6834" data={o.series.map((t) => ({ label: monthLabel(t.month), value: t.expenses }))} height={230} />
          </Frame>
        </div>
      );
    case "investment":
      return (
        <div className="grid gap-6 lg:grid-cols-2">
          <PrimaryViz opportunity={o} />
          <Frame title="Evolução em 12 meses" subtitle="Investimentos no banco principal e nas outras instituições">
            <PrimaryVsExternal series={o.series} primaryKey="investments_primary" externalKey="investments_external" label="Investimentos" />
          </Frame>
        </div>
      );
    case "debt_optimization":
      return (
        <div className="grid gap-6 lg:grid-cols-2">
          <DebtBlock o={o} />
          <Frame title="Dívida total em 12 meses">
            <AreaTrend id="debt-total" name="Dívida total" color="#e34948" data={o.series.map((t) => ({ label: monthLabel(t.month), value: t.debt_total }))} height={260} />
          </Frame>
        </div>
      );
    case "credit": {
      const ctx = o.context as { loans: { name: string; label: string; balance: number; rate: number; reference_rate: number; remaining_months: number; savings: number }[] };
      return (
        <div className="grid gap-6 lg:grid-cols-2">
          <Frame title="Taxa atual × referência do banco (% a.m.)">
            <CreditRates o={o} />
          </Frame>
          <Frame title="Contratos elegíveis">
            <div className="space-y-2">
              {ctx.loans.map((l) => (
                <div key={`${l.name}-${l.label}`} className="rounded-lg border border-line p-3.5 text-[13px]">
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold text-ink">
                      {l.label} · {l.name}
                    </span>
                    <span className="tnum font-bold text-ink">{brl(l.balance)}</span>
                  </div>
                  <div className="mt-1 text-ink-3">
                    {rate(l.rate)} → {rate(l.reference_rate)} · {l.remaining_months} parcelas · economia estimada{" "}
                    <span className="font-semibold text-accent-ink">{brl(l.savings)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Frame>
        </div>
      );
    }
    case "spending_migration": {
      const ctx = o.context as { primary_share: number; external_share: number; previous_external_share: number; by_institution: Holder[] };
      const data = o.series.map((t) => ({ label: monthLabel(t.month), "Cartão do banco": t.card_spend_primary, "Cartões concorrentes": t.card_spend_external }));
      return (
        <div className="grid gap-6 lg:grid-cols-2">
          <Frame title="Participação nos gastos com cartão (último trimestre)">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-accent-soft/70 p-4">
                <div className="text-[12.5px] text-ink-3">Cartão do banco principal</div>
                <div className="tnum text-[28px] font-bold text-[#0a1440]">{pct(ctx.primary_share)}</div>
              </div>
              <div className="rounded-lg bg-surface-2 p-4">
                <div className="text-[12.5px] text-ink-3">Cartões concorrentes</div>
                <div className="tnum text-[28px] font-bold text-[#0a1440]">{pct(ctx.external_share)}</div>
                <div className="text-[12px] text-ink-3">era {pct(ctx.previous_external_share)} no trimestre anterior</div>
              </div>
            </div>
            {ctx.by_institution.length > 0 && (
              <div className="mt-4">
                <BarList items={ctx.by_institution.map((b) => ({ key: b.institution_id, label: b.name, value: b.value, display: `${brl(b.value)}/mês` }))} color="var(--color-context)" />
              </div>
            )}
          </Frame>
          <Frame title="Gasto mensal com cartão" subtitle="Banco principal (verde) e concorrentes (cinza)">
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={12} />
                  <YAxis width={76} tickLine={false} axisLine={false} tickFormatter={brlCompact} />
                  <Tooltip cursor={{ fill: "rgb(20 108 236 / 0.05)" }} content={<ChartTooltip />} />
                  <Legend iconType="rect" iconSize={9} wrapperStyle={{ fontSize: 12, color: "var(--color-ink-2)" }} />
                  <Bar dataKey="Cartão do banco" stackId="c" fill="var(--color-accent)" maxBarSize={22} stroke="#fff" strokeWidth={1} isAnimationActive={false} />
                  <Bar dataKey="Cartões concorrentes" stackId="c" fill="var(--color-context)" radius={[4, 4, 0, 0]} maxBarSize={22} stroke="#fff" strokeWidth={1} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Frame>
        </div>
      );
    }
    case "relationship":
      return (
        <div className="grid gap-6 lg:grid-cols-2">
          <PrimaryViz opportunity={o} />
          <Frame title="Patrimônio: banco principal × outras instituições">
            <PrimaryVsExternal series={o.series} primaryKey="balance_primary" externalKey="balance_external" label="Saldo em conta" />
          </Frame>
        </div>
      );
    case "retention":
      return (
        <div className="grid gap-6 lg:grid-cols-2">
          <Frame title="Saldo no banco principal">
            <AreaTrend id="ret-bal" name="Saldo no banco principal" data={o.series.map((t) => ({ label: monthLabel(t.month), value: t.balance_primary }))} height={220} />
          </Frame>
          <Frame title="Investimentos: banco principal × outras instituições">
            <PrimaryVsExternal series={o.series} primaryKey="investments_primary" externalKey="investments_external" label="Investimentos" />
          </Frame>
          <div className="lg:col-span-2">
            <Frame title="Instituição que recebeu o salário, mês a mês">
              <SalaryChips o={o} />
            </Frame>
          </div>
        </div>
      );
  }
}
