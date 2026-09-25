"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BrainCircuit, Radar } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { OpportunityIcon } from "@/components/ui/OpportunityTag";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { api } from "@/lib/api";
import { brl, brlCompact, monthLabel, num, pct } from "@/lib/format";
import { useRole } from "@/lib/role";
import type { AnalyticsOverview } from "@/lib/types";
import { cn } from "@/lib/utils";

function Histogram({ data, name }: { data: AnalyticsOverview["health_histogram"]; name: string }) {
  return (
    <div className="h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="bin" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 10 }} />
          <YAxis width={44} tickLine={false} axisLine={false} tickFormatter={(v: number) => num(v)} />
          <Tooltip cursor={{ fill: "rgb(255 255 255 / 0.03)" }} content={<ChartTooltip valueFormatter={(v) => `${num(v)} clientes`} />} />
          <Bar dataKey="count" name={name} fill="var(--color-blue)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type ScatterPoint = AnalyticsOverview["scatter"][number];

function SegmentScatter({ points, selected, segmentName }: { points: ScatterPoint[]; selected: number | null; segmentName: (id: number) => string }) {
  const toXY = (p: ScatterPoint) => ({ ...p, x: Math.max(p.income, 1000), y: p.external_asset_share * 100 });
  const focus = points.filter((p) => selected === null || p.segment_id === selected).map(toXY);
  const rest = selected === null ? [] : points.filter((p) => p.segment_id !== selected).map(toXY);
  return (
    <div className="h-[380px]">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid />
          <XAxis
            type="number"
            dataKey="x"
            name="Renda"
            scale="log"
            domain={[1500, 100000]}
            ticks={[2000, 5000, 10000, 20000, 50000, 100000]}
            tickFormatter={brlCompact}
            tickLine={false}
            axisLine={false}
          />
          <YAxis type="number" dataKey="y" name="Patrimônio fora" unit="%" width={48} tickLine={false} axisLine={false} domain={[0, 100]} />
          <ZAxis range={[18, 18]} />
          <Tooltip
            cursor={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as ScatterPoint & { y: number };
              return (
                <div className="rounded-lg border border-line-strong bg-[#0f1729]/95 px-3 py-2 text-[12px] shadow-xl">
                  <div className="font-medium text-ink">{p.name}</div>
                  <div className="text-ink-3">{segmentName(p.segment_id)}</div>
                  <div className="mt-1 text-ink-2">
                    Renda <span className="font-semibold text-ink">{brl(p.income)}</span> · {pct(p.external_asset_share)} do patrimônio fora
                  </div>
                </div>
              );
            }}
          />
          {rest.length > 0 && <Scatter data={rest} fill="var(--color-context)" fillOpacity={0.3} isAnimationActive={false} />}
          <Scatter data={focus} fill={selected === null ? "var(--color-blue)" : "var(--color-accent)"} fillOpacity={0.6} isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function AnalyticsPage() {
  const role = useRole();
  const [selected, setSelected] = useState<number | null>(null);
  const { data, error } = useQuery({ queryKey: ["analytics", role], queryFn: api.analytics });

  if (error) return <ErrorState error={error} className="mt-24" />;
  if (!data) return <Skeleton className="h-[80vh] rounded-xl" />;
  const segmentName = (id: number) => data.segments.find((s) => s.segment_id === id)?.name ?? `Segmento ${id}`;
  const trend = data.trend.map((t) => ({
    label: monthLabel(t.month),
    "Saldos em conta": t.balances_primary_share,
    Investimentos: t.investments_primary_share,
    "Gastos com cartão": t.card_primary_share,
  }));

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Machine Learning"
        title="Analytics"
        description="Segmentação comportamental não supervisionada, distribuições da carteira e detecção de anomalias — base para os modelos preditivos da próxima versão."
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-blue/10 text-[#8fb9f0] ring-blue/20">
              <BrainCircuit className="size-3" /> {data.model.algorithm} · k={data.model.k}
            </Badge>
            {data.model.silhouette !== null && <Badge>Silhouette {num(data.model.silhouette, 2)}</Badge>}
            <Badge className="bg-violet/12 text-[#c9c3f7] ring-violet/25">
              <Radar className="size-3" /> {data.model.anomaly_algorithm} · {data.model.anomalies} anomalias
            </Badge>
          </div>
        }
      />

      {/* Segments */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.segments.map((s) => {
          const active = selected === s.segment_id;
          return (
            <button
              key={s.segment_id}
              onClick={() => setSelected(active ? null : s.segment_id)}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors",
                active ? "border-accent/45 bg-accent/[0.06]" : "border-white/[0.06] bg-surface hover:border-white/12",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-[14px] font-semibold text-ink">{s.name}</div>
                <span className="tnum text-[12px] text-ink-3">{num(s.size)} clientes</span>
              </div>
              <p className="mt-1 text-[12.5px] leading-snug text-ink-3">{s.description}</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
                <div>
                  <div className="text-ink-3">Renda média</div>
                  <div className="tnum font-medium text-ink">{brlCompact(s.profile.avg_income)}</div>
                </div>
                <div>
                  <div className="text-ink-3">Patrimônio méd.</div>
                  <div className="tnum font-medium text-ink">{brlCompact(s.profile.median_assets)}</div>
                </div>
                <div>
                  <div className="text-ink-3">Health</div>
                  <div className="tnum font-medium text-ink">{num(s.profile.health_score)}</div>
                </div>
                <div>
                  <div className="text-ink-3">Patrim. fora</div>
                  <div className="tnum font-medium text-ink">{pct(s.profile.external_asset_share)}</div>
                </div>
                <div>
                  <div className="text-ink-3">Cartão fora</div>
                  <div className="tnum font-medium text-ink">{pct(s.profile.card_external_share)}</div>
                </div>
                <div>
                  <div className="text-ink-3">Parcelas/renda</div>
                  <div className="tnum font-medium text-ink">{pct(s.profile.debt_service_ratio)}</div>
                </div>
              </div>
              {s.opportunities.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-ink-3">
                  {s.opportunities.slice(0, 3).map((o) => (
                    <span key={o.type} className="inline-flex items-center gap-1">
                      <OpportunityIcon type={o.type} className="size-3" /> {o.label} <span className="text-ink-2">{num(o.count)}</span>
                    </span>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader
            title="Renda × patrimônio fora do banco"
            subtitle={selected === null ? "Amostra de 900 clientes · selecione um segmento para destacá-lo" : `Destaque: ${segmentName(selected)}`}
            actions={
              selected !== null && (
                <Link href={`/clientes?segment_id=${selected}`} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-accent-soft hover:text-accent">
                  Ver clientes <ArrowRight className="size-3.5" />
                </Link>
              )
            }
          />
          <div className="px-3 pb-3">
            <SegmentScatter points={data.scatter} selected={selected} segmentName={segmentName} />
          </div>
        </Card>
        <Card className="xl:col-span-4">
          <CardHeader title="Participação do banco principal" subtitle="% da carteira em cada produto, mês a mês" />
          <div className="px-3 pb-4">
            <div className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={20} />
                  <YAxis width={44} tickLine={false} axisLine={false} domain={[0.3, 0.8]} ticks={[0.3, 0.4, 0.5, 0.6, 0.7, 0.8]} tickFormatter={(v: number) => pct(v)} />
                  <Tooltip cursor={{ stroke: "var(--color-line-strong)" }} content={<ChartTooltip valueFormatter={(v) => pct(v, 1)} />} />
                  <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: "var(--color-ink-2)" }} />
                  <Line type="monotone" dataKey="Saldos em conta" stroke="var(--color-blue)" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="Investimentos" stroke="var(--color-orange)" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="Gastos com cartão" stroke="var(--color-aqua)" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Distribuição do Financial Health" subtitle="Faixas: crítica < 45 · atenção 45–64 · saudável 65–79 · excelente ≥ 80" />
          <div className="px-3 pb-4">
            <Histogram data={data.health_histogram} name="Clientes" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Distribuição do Opportunity Score" subtitle="Clientes com ao menos uma oportunidade (score mínimo 45)" />
          <div className="px-3 pb-4">
            <Histogram data={data.score_histogram} name="Clientes" />
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          icon={<Radar className="size-4" />}
          title="Comportamento atípico"
          subtitle="Isolation Forest sobre variações trimestrais de gastos, saldo, renda, investimentos e dívida"
          actions={
            <Link href="/clientes?anomaly=true" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-accent-soft hover:text-accent">
              Ver todos <ArrowRight className="size-3.5" />
            </Link>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead>
              <tr className="border-y border-line text-[11.5px] tracking-wide text-ink-3 uppercase">
                <th className="px-5 py-2.5 font-medium">Cliente</th>
                <th className="px-3 py-2.5 font-medium">Score de anomalia</th>
                <th className="px-3 py-2.5 font-medium">O que mudou</th>
                <th className="px-3 py-2.5 text-right font-medium">Health</th>
              </tr>
            </thead>
            <tbody>
              {data.anomalies.map((a) => (
                <tr key={a.customer_id} className="border-b border-line/70 last:border-0 hover:bg-white/[0.025]">
                  <td className="px-5 py-2.5">
                    <Link href={`/clientes/${a.customer_id}`} className="font-medium text-ink hover:text-accent-soft">
                      {a.name}
                    </Link>
                    <div className="text-[12px] text-ink-3">{a.customer_id}</div>
                  </td>
                  <td className="tnum px-3 py-2.5 text-ink">{num(a.score, 2)}</td>
                  <td className="px-3 py-2.5 text-[12.5px] text-ink-2">{a.reasons.join(" · ")}</td>
                  <td className="tnum px-3 py-2.5 text-right text-ink">{a.health_score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
