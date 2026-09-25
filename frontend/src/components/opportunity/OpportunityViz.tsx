"use client";

import { ArrowRight, Scale } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AreaTrend } from "@/components/charts/AreaTrend";
import { BarList } from "@/components/charts/BarList";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { ShareBar } from "@/components/charts/ShareBar";
import { InstitutionAvatar } from "@/components/ui/InstitutionAvatar";
import { Meter } from "@/components/ui/Meter";
import { brl, brlCompact, monthLabel, pct, rate } from "@/lib/format";
import { useInstitutions } from "@/lib/hooks";
import type { OpportunityDetail, TimelinePoint } from "@/lib/types";

type Ctx = Record<string, unknown>;

function Frame({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3">
        <div className="text-[13.5px] font-semibold text-ink">{title}</div>
        {subtitle && <div className="text-[12.5px] text-ink-3">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function PrimaryVsExternalTrend({ series, primaryKey, externalKey, label }: {
  series: TimelinePoint[];
  primaryKey: keyof TimelinePoint;
  externalKey: keyof TimelinePoint;
  label: string;
}) {
  const data = series.map((t) => ({ label: monthLabel(t.month), "Banco principal": Number(t[primaryKey]), "Outras instituições": Number(t[externalKey]) }));
  return (
    <div className="h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={16} />
          <YAxis width={76} tickLine={false} axisLine={false} tickFormatter={brlCompact} />
          <Tooltip cursor={{ stroke: "var(--color-line-strong)" }} content={<ChartTooltip />} />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: "var(--color-ink-2)" }} />
          <Line type="monotone" dataKey="Banco principal" name={`${label} · banco principal`} stroke="var(--color-accent)" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="Outras instituições" name={`${label} · outras instituições`} stroke="var(--color-context)" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function IdleCash({ o }: { o: OpportunityDetail }) {
  const ctx = o.context as Ctx;
  return (
    <Frame title="Saldo no banco principal (fim de mês)" subtitle="Linha tracejada: patamar mantido nos últimos 6 meses">
      <AreaTrend
        id="idle"
        name="Saldo no banco principal"
        data={o.series.map((t) => ({ label: monthLabel(t.month), value: t.balance_primary }))}
        height={240}
        reference={Number(ctx.threshold) > 0 ? { value: Number(ctx.threshold), label: `acima de ${brlCompact(Number(ctx.threshold))}` } : undefined}
      />
    </Frame>
  );
}

function Investment({ o }: { o: OpportunityDetail }) {
  const ctx = o.context as { internal: number; external: number; by_institution: { institution_id: string; name: string; value: number }[] };
  const items = [
    { key: "primary", label: "Banco principal", value: ctx.internal, display: brl(ctx.internal), highlight: true },
    ...ctx.by_institution.map((b) => ({ key: b.institution_id, label: b.name, value: b.value, display: brl(b.value) })),
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Frame title="Onde estão os investimentos" subtitle="Banco principal em destaque; outras instituições em cinza">
        <BarList items={items} color="var(--color-context)" />
        <div className="mt-4">
          <ShareBar primaryShare={ctx.internal / (ctx.internal + ctx.external || 1)} />
        </div>
      </Frame>
      <Frame title="Evolução em 12 meses">
        <PrimaryVsExternalTrend series={o.series} primaryKey="investments_primary" externalKey="investments_external" label="Investimentos" />
      </Frame>
    </div>
  );
}

function DebtOptimization({ o }: { o: OpportunityDetail }) {
  const ctx = o.context as { debt: number; available: number; savings_12m: number; loans: { name: string; label: string; balance: number; rate: number }[] };
  const coverage = ctx.debt ? ctx.available / ctx.debt : 0;
  return (
    <div className="rounded-xl border border-warning/25 bg-warning/[0.04] p-5">
      <div className="flex items-center gap-2 text-[12px] font-semibold tracking-[0.14em] text-warning uppercase">
        <Scale className="size-4" /> Ineficiência financeira detectada
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div className="rounded-lg border border-line bg-surface p-4">
          <div className="text-[12px] text-ink-3">Dívida cara</div>
          <div className="text-[26px] font-semibold text-ink">{brl(ctx.debt)}</div>
          <div className="mt-1 space-y-0.5 text-[12px] text-ink-2">
            {ctx.loans.map((l) => (
              <div key={`${l.name}-${l.label}`}>
                {l.label} · {l.name} · {rate(l.rate)}
              </div>
            ))}
          </div>
        </div>
        <ArrowRight className="mx-auto hidden size-5 text-ink-3 sm:block" />
        <div className="rounded-lg border border-line bg-surface p-4">
          <div className="text-[12px] text-ink-3">Saldo disponível</div>
          <div className="text-[26px] font-semibold text-ink">{brl(ctx.available)}</div>
          <div className="mt-1 text-[12px] text-ink-2">após reservar meia despesa mensal</div>
        </div>
      </div>
      <div className="mt-4">
        <div className="mb-1.5 flex justify-between text-[12.5px]">
          <span className="text-ink-2">Cobertura da dívida pelo saldo disponível</span>
          <span className="tnum font-semibold text-ink">{pct(coverage)}</span>
        </div>
        <Meter value={Math.min(coverage, 1)} color="var(--color-blue)" />
      </div>
      <p className="mt-4 text-[13px] text-ink-2">
        Economia estimada em 12 meses ao amortizar: <span className="font-semibold text-ink">{brl(ctx.savings_12m)}</span> (juros evitados menos
        o rendimento de ~0,85% a.m. que o saldo deixaria de ter).
      </p>
    </div>
  );
}

function Credit({ o }: { o: OpportunityDetail }) {
  const ctx = o.context as { loans: { name: string; label: string; balance: number; rate: number; reference_rate: number; remaining_months: number; savings: number }[] };
  const data = ctx.loans.map((l) => ({ label: `${l.label} · ${l.name}`, "Taxa atual": l.rate, "Referência do banco": l.reference_rate }));
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Frame title="Taxa atual vs. referência do banco (% a.m.)">
        <div style={{ height: 70 + ctx.loans.length * 70 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }} barGap={2}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}%`} />
              <YAxis type="category" dataKey="label" width={170} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "rgb(255 255 255 / 0.03)" }} content={<ChartTooltip valueFormatter={(v) => rate(v)} />} />
              <Legend iconType="rect" iconSize={8} wrapperStyle={{ fontSize: 12, color: "var(--color-ink-2)" }} />
              <Bar dataKey="Taxa atual" fill="var(--color-orange)" radius={[0, 4, 4, 0]} maxBarSize={14} isAnimationActive={false} />
              <Bar dataKey="Referência do banco" fill="var(--color-blue)" radius={[0, 4, 4, 0]} maxBarSize={14} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Frame>
      <Frame title="Contratos elegíveis">
        <div className="space-y-2">
          {ctx.loans.map((l) => (
            <div key={`${l.name}-${l.label}`} className="rounded-lg border border-line bg-white/[0.02] p-3 text-[12.5px]">
              <div className="flex justify-between gap-2">
                <span className="font-medium text-ink">{l.label} · {l.name}</span>
                <span className="tnum font-semibold text-ink">{brl(l.balance)}</span>
              </div>
              <div className="mt-1 text-ink-3">
                {rate(l.rate)} → {rate(l.reference_rate)} · {l.remaining_months} parcelas · economia estimada{" "}
                <span className="font-medium text-ink-2">{brl(l.savings)}</span>
              </div>
            </div>
          ))}
        </div>
      </Frame>
    </div>
  );
}

function SpendingMigration({ o }: { o: OpportunityDetail }) {
  const ctx = o.context as { primary_share: number; external_share: number; previous_external_share: number; by_institution: { name: string; value: number; institution_id: string }[] };
  const data = o.series.map((t) => ({ label: monthLabel(t.month), "Cartão do banco": t.card_spend_primary, "Cartões concorrentes": t.card_spend_external }));
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Frame title="Participação nos gastos com cartão (último trimestre)">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-accent/25 bg-accent/[0.05] p-4">
            <div className="text-[12px] text-ink-3">Cartão banco principal</div>
            <div className="text-[30px] font-semibold text-ink">{pct(ctx.primary_share)}</div>
          </div>
          <div className="rounded-lg border border-line bg-surface p-4">
            <div className="text-[12px] text-ink-3">Cartão concorrente</div>
            <div className="text-[30px] font-semibold text-ink">{pct(ctx.external_share)}</div>
            <div className="text-[11.5px] text-ink-3">era {pct(ctx.previous_external_share)} no trimestre anterior</div>
          </div>
        </div>
        <ShareBar primaryShare={ctx.primary_share} className="mt-4" externalLabel="Cartões concorrentes" primaryLabel="Cartão do banco" />
        {ctx.by_institution.length > 0 && (
          <div className="mt-4">
            <BarList items={ctx.by_institution.map((b) => ({ key: b.institution_id, label: b.name, value: b.value, display: `${brl(b.value)}/mês` }))} color="var(--color-context)" />
          </div>
        )}
      </Frame>
      <Frame title="Gasto mensal com cartão" subtitle="Banco principal (verde) vs. concorrentes (cinza)">
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={12} />
              <YAxis width={76} tickLine={false} axisLine={false} tickFormatter={brlCompact} />
              <Tooltip cursor={{ fill: "rgb(255 255 255 / 0.03)" }} content={<ChartTooltip />} />
              <Legend iconType="rect" iconSize={8} wrapperStyle={{ fontSize: 12, color: "var(--color-ink-2)" }} />
              <Bar dataKey="Cartão do banco" stackId="c" fill="var(--color-accent)" maxBarSize={22} stroke="var(--color-surface)" strokeWidth={1} isAnimationActive={false} />
              <Bar dataKey="Cartões concorrentes" stackId="c" fill="var(--color-context)" radius={[4, 4, 0, 0]} maxBarSize={22} stroke="var(--color-surface)" strokeWidth={1} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Frame>
    </div>
  );
}

function Relationship({ o }: { o: OpportunityDetail }) {
  const ctx = o.context as { map: { category: string; label: string; present: boolean; external_share: number; main_external: string | null }[] };
  return (
    <Frame title="Onde está o relacionamento financeiro" subtitle="Participação do banco principal por categoria de produto">
      <div className="space-y-4">
        {ctx.map.map((row) => (
          <div key={row.category}>
            <div className="mb-1.5 flex justify-between text-[12.5px]">
              <span className="font-medium text-ink">{row.label}</span>
              <span className="text-ink-3">
                {!row.present ? "Não possui" : row.external_share >= 0.6 ? `→ ${row.main_external ?? "outra instituição"}` : "Banco principal"}
              </span>
            </div>
            {row.present ? <ShareBar primaryShare={1 - row.external_share} showLegend={false} height={8} /> : <div className="h-2 rounded border border-dashed border-line-strong" />}
          </div>
        ))}
      </div>
    </Frame>
  );
}

function Retention({ o }: { o: OpportunityDetail }) {
  const institutions = useInstitutions();
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Frame title="Saldo no banco principal">
        <AreaTrend id="ret-bal" name="Saldo no banco principal" data={o.series.map((t) => ({ label: monthLabel(t.month), value: t.balance_primary }))} height={200} />
      </Frame>
      <Frame title="Investimentos: banco principal vs. outras instituições">
        <PrimaryVsExternalTrend series={o.series} primaryKey="investments_primary" externalKey="investments_external" label="Investimentos" />
      </Frame>
      <div className="lg:col-span-2">
        <Frame title="Instituição que recebeu o salário, mês a mês">
          <div className="flex flex-wrap gap-1.5">
            {o.series.map((t) => (
              <div key={t.month} className="rounded-md border border-line bg-surface px-2 py-1 text-center">
                <div className="text-[10.5px] text-ink-3">{monthLabel(t.month)}</div>
                <div className="mt-0.5 flex items-center justify-center gap-1 text-[12px] font-medium text-ink">
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
        </Frame>
      </div>
    </div>
  );
}

export function OpportunityViz({ opportunity }: { opportunity: OpportunityDetail }) {
  switch (opportunity.type) {
    case "idle_cash":
      return <IdleCash o={opportunity} />;
    case "investment":
      return <Investment o={opportunity} />;
    case "debt_optimization":
      return <DebtOptimization o={opportunity} />;
    case "credit":
      return <Credit o={opportunity} />;
    case "spending_migration":
      return <SpendingMigration o={opportunity} />;
    case "relationship":
      return <Relationship o={opportunity} />;
    case "retention":
      return <Retention o={opportunity} />;
  }
}
