"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { brlCompact, monthLabel } from "@/lib/format";
import type { TimelinePoint } from "@/lib/types";
import { ChartTooltip } from "./ChartTooltip";

/** One measure split in two lines: the primary bank (green) against every other institution (gray). */
export function PrimaryVsExternal({
  series,
  primaryKey,
  externalKey,
  label,
  height = 220,
}: {
  series: TimelinePoint[];
  primaryKey: keyof TimelinePoint;
  externalKey: keyof TimelinePoint;
  label: string;
  height?: number;
}) {
  const data = series.map((t) => ({ label: monthLabel(t.month), "Banco principal": Number(t[primaryKey]), "Outras instituições": Number(t[externalKey]) }));
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={16} tickMargin={8} />
          <YAxis width={76} tickLine={false} axisLine={false} tickFormatter={brlCompact} />
          <Tooltip cursor={{ stroke: "#c9d3e1" }} content={<ChartTooltip />} />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: "var(--color-ink-2)" }} />
          <Line type="monotone" dataKey="Banco principal" name={`${label} · banco principal`} stroke="var(--color-accent)" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="Outras instituições" name={`${label} · outras instituições`} stroke="var(--color-context)" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
