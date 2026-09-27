"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { Segmented } from "@/components/ui/Segmented";
import { brl, brlCompact, monthLabel, pct } from "@/lib/format";
import type { CashFlowBreakdown, TimelinePoint } from "@/lib/types";

// Validated pair: blue for money in / results, orange for money out.
const IN = "#2a78d6";
const OUT = "#eb6834";

type Step = { name: string; range: [number, number]; value: number; kind: "in" | "out" | "total" };

function steps(cf: CashFlowBreakdown): Step[] {
  let running = cf.income;
  const out = (name: string, value: number): Step => {
    const top = running;
    running -= value;
    return { name, range: [Math.min(top, running), Math.max(top, running)], value: -value, kind: "out" };
  };
  return [
    { name: "Renda", range: [0, cf.income], value: cf.income, kind: "in" },
    out("Gastos", cf.expenses),
    out("Dívidas", cf.debt_payments),
    out("Investimentos", cf.investments),
    { name: cf.available >= 0 ? "Disponível" : "Déficit", range: [Math.min(0, cf.available), Math.max(0, cf.available)], value: cf.available, kind: "total" },
  ];
}

/** Waterfall: where each real of income goes. */
export function CashFlowWaterfall({ lastMonth, average }: { lastMonth: CashFlowBreakdown; average: CashFlowBreakdown }) {
  const [mode, setMode] = useState<"avg" | "last">("avg");
  const cf = mode === "avg" ? average : lastMonth;
  const data = steps(cf);
  const color = (s: Step) => (s.kind === "out" || s.value < 0 ? OUT : IN);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-4 text-[12.5px] text-ink-2">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ backgroundColor: IN }} /> Entrada / resultado
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ backgroundColor: OUT }} /> Saída
          </span>
        </div>
        <Segmented
          size="sm"
          value={mode}
          onChange={setMode}
          options={[
            { value: "avg", label: "Média 6 meses" },
            { value: "last", label: "Último mês" },
          ]}
        />
      </div>
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 24, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis width={76} tickLine={false} axisLine={false} tickFormatter={brlCompact} />
            <ReferenceLine y={0} stroke="#c9d3e1" />
            <Tooltip
              cursor={{ fill: "rgb(20 108 236 / 0.05)" }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <ChartTooltip
                    active
                    label={String((payload[0].payload as Step).name)}
                    payload={[{ name: "Valor", value: (payload[0].payload as Step).value, color: color(payload[0].payload as Step) }]}
                  />
                ) : null
              }
            />
            <Bar dataKey="range" radius={4} maxBarSize={46} isAnimationActive={false}>
              {data.map((s) => (
                <Cell key={s.name} fill={color(s)} />
              ))}
              <LabelList dataKey="value" position="top" formatter={(v: unknown) => brl(Number(v))} style={{ fill: "#111c3a", fontSize: 12, fontWeight: 700 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[12.5px] sm:grid-cols-4">
        {[
          ["Gastos", cf.expenses],
          ["Dívidas", cf.debt_payments],
          ["Investimentos", cf.investments],
          [cf.available >= 0 ? "Disponível" : "Déficit", cf.available],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg bg-surface-2 px-3 py-2">
            <div className="text-ink-3">{label}</div>
            <div className="tnum font-semibold text-ink">{cf.income ? pct(Math.abs(Number(value)) / cf.income) : "—"} da renda</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Monthly income vs spending (two series, one axis, legend + crosshair tooltip). */
export function CashFlowTrend({ timeline }: { timeline: TimelinePoint[] }) {
  const data = timeline.map((t) => ({ label: monthLabel(t.month), Renda: t.income, Gastos: t.expenses }));
  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis width={76} tickLine={false} axisLine={false} tickFormatter={brlCompact} />
          <Tooltip cursor={{ stroke: "#c9d3e1" }} content={<ChartTooltip />} />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: "var(--color-ink-2)", paddingTop: 8 }} />
          <Line type="monotone" dataKey="Renda" stroke={IN} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }} isAnimationActive={false} />
          <Line type="monotone" dataKey="Gastos" stroke={OUT} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
