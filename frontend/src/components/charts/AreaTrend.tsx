"use client";

import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { brl, brlCompact } from "@/lib/format";
import { ChartTooltip } from "./ChartTooltip";

/** Single-series trend: 2px line over a ~10% wash, crosshair tooltip, hairline grid. */
export function AreaTrend({
  data,
  name,
  color = "var(--color-blue)",
  height = 180,
  axes = true,
  reference,
  valueFormatter = brl,
  tickFormatter = brlCompact,
  id,
}: {
  data: { label: string; value: number }[];
  name: string;
  color?: string;
  height?: number;
  axes?: boolean;
  reference?: { value: number; label: string };
  valueFormatter?: (v: number) => string;
  tickFormatter?: (v: number) => string;
  id: string;
}) {
  const gradientId = `area-${id}`;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: axes ? 8 : 2, bottom: 0, left: axes ? 0 : 2 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {axes && <CartesianGrid vertical={false} />}
          <XAxis dataKey="label" hide={!axes} tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
          <YAxis hide={!axes} width={76} tickLine={false} axisLine={false} tickFormatter={tickFormatter} domain={["auto", "auto"]} />
          <Tooltip
            cursor={{ stroke: "var(--color-line-strong)", strokeWidth: 1 }}
            content={<ChartTooltip valueFormatter={valueFormatter} />}
          />
          {reference && (
            <ReferenceLine
              y={reference.value}
              stroke="var(--color-ink-3)"
              strokeDasharray="4 4"
              label={{ value: reference.label, position: "insideTopLeft", fill: "var(--color-ink-3)", fontSize: 11 }}
            />
          )}
          <Area
            type="monotone"
            dataKey="value"
            name={name}
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            activeDot={{ r: 4, stroke: "var(--color-surface)", strokeWidth: 2, fill: color }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
