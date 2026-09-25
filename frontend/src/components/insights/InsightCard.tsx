"use client";

import { ArrowRight, Info, Sparkles, TrendingDown, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Area, AreaChart, Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { brl, brlCompact, num, pct } from "@/lib/format";
import { INSIGHT_CATEGORY } from "@/lib/labels";
import type { Insight } from "@/lib/types";
import { cn } from "@/lib/utils";

const SEVERITY = {
  opportunity: { label: "Oportunidade", icon: Sparkles, className: "bg-accent/12 text-accent-soft ring-accent/25" },
  risk: { label: "Risco", icon: TrendingDown, className: "bg-critical/15 text-[#f07171] ring-critical/30" },
  attention: { label: "Atenção", icon: TriangleAlert, className: "bg-warning/12 text-warning ring-warning/25" },
  info: { label: "Contexto", icon: Info, className: "bg-blue/12 text-[#8fb9f0] ring-blue/25" },
};

export function headline(insight: Insight): string {
  if (insight.headline_format === "currency") return brlCompact(insight.headline_value);
  if (insight.headline_format === "percent") return pct(insight.headline_value);
  return num(insight.headline_value);
}

export function insightHref(insight: Insight): string {
  const params = new URLSearchParams();
  params.set("insight", insight.insight_id);
  return `/clientes?${params.toString()}`;
}

function MiniChart({ chart }: { chart: NonNullable<Insight["chart"]> }) {
  if (chart.type === "bar") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chart.data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 10 }} />
          <Tooltip cursor={{ fill: "rgb(255 255 255 / 0.03)" }} content={<ChartTooltip valueFormatter={(v) => (v > 1000 ? brl(v) : num(v))} />} />
          <Bar dataKey="value" name="Valor" fill="var(--color-blue)" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    );
  }
  if (chart.type === "line") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chart.data} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} tick={{ fontSize: 10 }} />
          <YAxis hide domain={["auto", "auto"]} />
          <Tooltip cursor={{ stroke: "var(--color-line-strong)" }} content={<ChartTooltip valueFormatter={(v) => pct(v, 1)} />} />
          <Line type="monotone" dataKey="value" name="Participação do banco" stroke="var(--color-accent)" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chart.data} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} tick={{ fontSize: 10 }} />
        <Tooltip cursor={{ stroke: "var(--color-line-strong)" }} content={<ChartTooltip />} />
        <Area type="monotone" dataKey="Concorrentes" stackId="1" stroke="var(--color-context)" strokeWidth={2} fill="var(--color-context)" fillOpacity={0.12} isAnimationActive={false} />
        <Area type="monotone" dataKey="Banco principal" stackId="1" stroke="var(--color-accent)" strokeWidth={2} fill="var(--color-accent)" fillOpacity={0.1} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function InsightCard({ insight, compact = false }: { insight: Insight; compact?: boolean }) {
  const severity = SEVERITY[insight.severity];
  const Icon = severity.icon;
  return (
    <Card className="flex h-full flex-col p-5 transition-colors hover:border-white/10">
      <div className="flex items-center justify-between gap-2">
        <Badge className={severity.className}>
          <Icon className="size-3" /> {severity.label}
        </Badge>
        <span className="text-[11.5px] text-ink-3">{INSIGHT_CATEGORY[insight.category] ?? insight.category}</span>
      </div>
      <div className="mt-4 text-[30px] leading-none font-semibold tracking-tight text-ink">{headline(insight)}</div>
      <p className="mt-2 text-[14px] leading-snug font-medium text-ink">{insight.title}</p>
      {!compact && <p className="mt-2 text-[12.5px] leading-relaxed text-ink-3">{insight.description}</p>}
      {!compact && insight.chart && insight.chart.data.length > 0 && (
        <div className="mt-4 h-[110px]">
          <MiniChart chart={insight.chart} />
        </div>
      )}
      <div className={cn("mt-auto flex items-center justify-between gap-2 pt-4 text-[12.5px]")}>
        <span className="text-ink-3">
          {insight.affected_customers > 0 ? `${num(insight.affected_customers)} clientes` : "Indicador da carteira"}
        </span>
        {insight.affected_customers > 0 && (
          <Link href={insightHref(insight)} className="inline-flex items-center gap-1 font-medium text-accent-soft hover:text-accent">
            Ver clientes <ArrowRight className="size-3.5" />
          </Link>
        )}
      </div>
    </Card>
  );
}
