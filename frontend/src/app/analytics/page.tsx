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
import { Avatar } from "@/components/ui/Avatar";
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
    <div className="h-[230px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="bin" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 10.5 }} />
          <YAxis width={44} tickLine={false} axisLine={false} tickFormatter={(v: number) => num(v)} />
          <Tooltip cursor={{ fill: "rgb(20 108 236 / 0.05)" }} content={<ChartTooltip valueFormatter={(v) => `${num(v)} clientes`} />} />
          <Bar dataKey="count" name={name} fill="var(--color-primary)" radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />
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
                <div className="rounded-lg bg-[#0d2d54] px-3 py-2 text-[12px] text-white shadow-lg">
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-white/70">{segmentName(p.segment_id)}</div>
                  <div className="mt-1 text-white/85">
                    Renda <span className="font-bold text-white">{brl(p.income)}</span> · {pct(p.external_asset_share)} do patrimônio fora
                  </div>
                </div>
              );
            }}
          />
          {rest.length > 0 && <Scatter data={rest} fill="var(--color-context)" fillOpacity={0.3} isAnimationActive={false} />}
          <Scatter data={focus} fill={selected === null ? "var(--color-primary)" : "var(--color-accent)"} fillOpacity={0.55} isAnimationActive={false} />
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
        title="Análises"
        description="Segmentação comportamental, distribuições da carteira e detecção de anomalias com machine learning"
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge tone="blue">
              <BrainCircuit className="size-3.5" /> {data.model.algorithm} · k={data.model.k}
            </Badge>
            {data.model.silhouette !== null && <Badge tone="gray">Silhouette {num(data.model.silhouette, 2)}</Badge>}
            <Badge tone="violet">
              <Radar className="size-3.5" /> {data.model.anomaly_algorithm} · {data.model.anomalies} anomalias
            </Badge>
          </div>
        }
      />

      {/* Segments */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.segments.map((s) => {
          const active = selected === s.segment_id;
          return (
            <button
              key={s.segment_id}
              type="button"
              onClick={() => setSelected(active ? null : s.segment_id)}
              aria-pressed={active}
              className={cn(
                "flex min-w-0 flex-col rounded-xl border bg-white p-5 text-left shadow-card transition-all",
                active ? "border-primary/50 ring-3 ring-primary/10" : "border-line hover:shadow-pop",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-[15px] font-semibold text-ink">{s.name}</div>
                <span className="tnum shrink-0 text-[12.5px] text-ink-3">{num(s.size)} clientes</span>
              </div>
              <p className="mt-1 text-[13px] leading-snug text-ink-2">{s.description}</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[12.5px]">
                {[
                  ["Renda média", brlCompact(s.profile.avg_income)],
                  ["Patrimônio méd.", brlCompact(s.profile.median_assets)],
                  ["Saúde", num(s.profile.health_score)],
                  ["Patrim. fora", pct(s.profile.external_asset_share)],
                  ["Cartão fora", pct(s.profile.card_external_share)],
                  ["Parcelas/renda", pct(s.profile.debt_service_ratio)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-surface-2 px-2.5 py-1.5">
                    <div className="text-ink-3">{label}</div>
                    <div className="tnum font-semibold text-ink">{value}</div>
                  </div>
                ))}
              </div>
              {s.opportunities.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-ink-3">
                  {s.opportunities.slice(0, 3).map((o) => (
                    <span key={o.type} className="inline-flex items-center gap-1">
                      <OpportunityIcon type={o.type} className="size-3.5" /> {o.label} <span className="font-semibold text-ink-2">{num(o.count)}</span>
                    </span>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <Card>
          <CardHeader
            title="Renda × patrimônio fora do banco"
            subtitle={selected === null ? "Amostra de 900 clientes · selecione um segmento para destacá-lo" : `Destaque: ${segmentName(selected)}`}
            actions={
              selected !== null && (
                <Link href={`/clientes?segment_id=${selected}`} className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary-ink hover:underline">
                  Ver clientes <ArrowRight className="size-3.5" />
                </Link>
              )
            }
          />
          <div className="px-3 pb-3">
            <SegmentScatter points={data.scatter} selected={selected} segmentName={segmentName} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Participação do banco principal" subtitle="% da carteira em cada produto, mês a mês" />
          <div className="px-3 pb-4">
            <div className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={20} />
                  <YAxis width={44} tickLine={false} axisLine={false} domain={[0.3, 0.8]} ticks={[0.3, 0.4, 0.5, 0.6, 0.7, 0.8]} tickFormatter={(v: number) => pct(v)} />
                  <Tooltip cursor={{ stroke: "#c9d3e1" }} content={<ChartTooltip valueFormatter={(v) => pct(v, 1)} />} />
                  <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: "var(--color-ink-2)" }} />
                  <Line type="monotone" dataKey="Saldos em conta" stroke="#2a78d6" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="Investimentos" stroke="#eb6834" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="Gastos com cartão" stroke="#1baf7a" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Distribuição da saúde financeira" subtitle="Faixas: crítica < 45 · atenção 45–64 · saudável 65–79 · excelente ≥ 80" />
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
          icon={<Radar className="size-4 text-ai" />}
          title="Comportamento atípico"
          subtitle="Isolation Forest sobre variações trimestrais de gastos, saldo, renda, investimentos e dívida"
          actions={
            <Link href="/clientes?anomaly=true" className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary-ink hover:underline">
              Ver todos <ArrowRight className="size-3.5" />
            </Link>
          }
        />
        <div className="overflow-x-auto px-5 pb-4">
          <table className="w-full min-w-[720px] text-left text-[13.5px]">
            <thead>
              <tr className="bg-surface-2 text-[12.5px] text-ink-2">
                <th className="rounded-l-lg px-4 py-2.5 font-medium">Cliente</th>
                <th className="px-3 py-2.5 font-medium">Score de anomalia</th>
                <th className="px-3 py-2.5 font-medium">O que mudou</th>
                <th className="rounded-r-lg px-4 py-2.5 text-right font-medium">Saúde</th>
              </tr>
            </thead>
            <tbody>
              {data.anomalies.map((a) => (
                <tr key={a.customer_id} className="border-b border-line last:border-0 hover:bg-[#f9fbfe]">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={a.name} />
                      <div>
                        <Link href={`/clientes/${a.customer_id}`} className="font-semibold text-ink hover:text-primary-ink">
                          {a.name}
                        </Link>
                        <div className="text-[12px] text-ink-3">{a.customer_id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="tnum px-3 py-2.5 text-ink">{num(a.score, 2)}</td>
                  <td className="px-3 py-2.5 text-[13px] text-ink-2">{a.reasons.join(" · ")}</td>
                  <td className="tnum px-4 py-2.5 text-right font-semibold text-ink">{a.health_score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
