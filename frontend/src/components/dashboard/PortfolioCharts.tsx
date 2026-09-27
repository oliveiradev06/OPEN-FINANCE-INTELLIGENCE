"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { monthLabel, monthShort, num, pct } from "@/lib/format";
import type { PortfolioSummary } from "@/lib/types";

const CONNECTED = { name: "Clientes conectados", color: "#16a36b", top: "#47c98d" };
const CONSENTS = { name: "Consentimentos", color: "#2f80ed", top: "#5aa1f6" };

function Diamond({ color }: { color: string }) {
  return <span className="size-2 rotate-45 rounded-[2px]" style={{ backgroundColor: color }} />;
}

/**
 * Open Finance adoption: customers sharing data and consents granted (cumulative, month end).
 * Same unit on one axis; the consent bar sits behind, offset, like a shadow of the customer bar.
 */
export function PortfolioEvolution({ points }: { points: PortfolioSummary["connections_trend"] }) {
  const data = points.map((p) => ({
    label: points.length > 6 ? monthLabel(p.month) : monthShort(p.month),
    [CONSENTS.name]: p.consents,
    [CONNECTED.name]: p.customers_connected,
  }));
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-ink-2">
        <span className="flex items-center gap-2">
          <Diamond color={CONNECTED.color} /> {CONNECTED.name}
        </span>
        <span className="flex items-center gap-2">
          <Diamond color={CONSENTS.color} /> {CONSENTS.name}
        </span>
      </div>
      <div className="h-[208px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barGap={-10} barCategoryGap="26%">
            <defs>
              <linearGradient id="evo-consents" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={CONSENTS.top} />
                <stop offset="1" stopColor={CONSENTS.color} />
              </linearGradient>
              <linearGradient id="evo-connected" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={CONNECTED.top} />
                <stop offset="1" stopColor={CONNECTED.color} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={0} />
            <YAxis width={54} tickLine={false} axisLine={false} tickFormatter={(v: number) => (v >= 1000 ? `${num(v / 1000)} mil` : num(v))} />
            <Tooltip cursor={{ fill: "rgb(20 108 236 / 0.05)" }} content={<ChartTooltip valueFormatter={(v) => num(v)} />} />
            <Bar dataKey={CONSENTS.name} fill="url(#evo-consents)" radius={[4, 4, 0, 0]} maxBarSize={20} isAnimationActive={false} />
            <Bar
              dataKey={CONNECTED.name}
              fill="url(#evo-connected)"
              radius={[4, 4, 0, 0]}
              maxBarSize={20}
              stroke="#ffffff"
              strokeWidth={1.5}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Ordered bands, green (high potential) to coral (low); every bar carries its % label.
const BAND_COLORS: Record<string, [string, string]> = {
  very_high: ["#0b6e52", "#1b8466"],
  high: ["#17a06a", "#46c08d"],
  medium: ["#7cd3ac", "#a2e2c5"],
  low: ["#f2b544", "#f7cd79"],
  very_low: ["#e8704f", "#f09477"],
};

function BandTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  const words = (payload?.value ?? "").split(" ");
  return (
    <text x={x} y={(y ?? 0) + 4} textAnchor="middle" className="fill-ink-2 text-[11.5px]">
      {words.map((word, i) => (
        <tspan key={word} x={x} dy={i === 0 ? 10 : 13}>
          {word}
        </tspan>
      ))}
    </text>
  );
}

export function ScoreBands({ bands }: { bands: PortfolioSummary["score_bands"] }) {
  return (
    <div className="h-[236px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={bands} margin={{ top: 24, right: 4, left: 4, bottom: 4 }} barCategoryGap="22%">
          <defs>
            {Object.entries(BAND_COLORS).map(([key, [base, top]]) => (
              <linearGradient key={key} id={`band-${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={top} />
                <stop offset="0.35" stopColor={base} />
              </linearGradient>
            ))}
          </defs>
          <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} height={38} tick={<BandTick />} />
          <YAxis hide domain={[0, "dataMax"]} />
          <Tooltip
            cursor={{ fill: "rgb(20 108 236 / 0.05)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const band = payload[0].payload as PortfolioSummary["score_bands"][number];
              return (
                <div className="rounded-lg bg-[#0d2d54] px-3 py-2 text-white shadow-lg">
                  <div className="text-[12px] text-white/70">
                    {band.label} · score {band.min}–{band.max}
                  </div>
                  <div className="tnum text-[13px] font-bold">
                    {num(band.count)} clientes · {pct(band.share)}
                  </div>
                </div>
              );
            }}
          />
          <Bar dataKey="share" radius={[6, 6, 0, 0]} maxBarSize={38} isAnimationActive={false}>
            {bands.map((band) => (
              <Cell key={band.key} fill={`url(#band-${band.key})`} />
            ))}
            <LabelList
              dataKey="share"
              position="top"
              offset={8}
              formatter={(value: unknown) => pct(Number(value))}
              style={{ fill: "#111c3a", fontSize: 12.5, fontWeight: 700 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
