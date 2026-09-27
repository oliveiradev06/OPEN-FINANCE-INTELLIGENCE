"use client";

import { Cell, Pie, PieChart, Tooltip } from "recharts";
import { pct } from "@/lib/format";
import { cn } from "@/lib/utils";

export type DonutSlice = { key: string; label: string; value: number; color: string };

/**
 * Part-to-whole ring with the total in the middle and a legend that prints every share,
 * so the colors (some below 3:1 on white) are never the only way to read a slice.
 */
export function Donut({
  slices,
  centerValue,
  centerLabel,
  size = 184,
  thickness = 26,
  valueFormatter,
  onSelect,
  className,
  centerClassName = "text-[26px]",
}: {
  slices: DonutSlice[];
  centerValue: React.ReactNode;
  centerLabel: string;
  size?: number;
  thickness?: number;
  valueFormatter: (value: number) => string;
  onSelect?: (key: string) => void;
  className?: string;
  centerClassName?: string;
}) {
  const visible = slices.filter((s) => s.value > 0);
  const total = visible.reduce((sum, s) => sum + s.value, 0) || 1;
  return (
    <div className={cn("flex flex-col items-center gap-6 sm:flex-row sm:items-center", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <PieChart width={size} height={size}>
          <Pie
            data={visible}
            dataKey="value"
            nameKey="label"
            innerRadius={size / 2 - thickness}
            outerRadius={size / 2 - 1}
            startAngle={90}
            endAngle={-270}
            stroke="#ffffff"
            strokeWidth={2}
            isAnimationActive={false}
            onClick={onSelect ? (_: unknown, index: number) => onSelect(visible[index].key) : undefined}
            className={onSelect ? "cursor-pointer" : undefined}
          >
            {visible.map((s) => (
              <Cell key={s.key} fill={s.color} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const slice = payload[0].payload as DonutSlice;
              return (
                <div className="rounded-lg bg-[#0d2d54] px-3 py-2 text-white shadow-lg">
                  <div className="flex items-center gap-2 text-[12px] text-white/75">
                    <span className="size-2 rounded-full" style={{ backgroundColor: slice.color }} />
                    {slice.label}
                  </div>
                  <div className="tnum mt-0.5 text-[13px] font-bold">
                    {valueFormatter(slice.value)} · {pct(slice.value / total, 1)}
                  </div>
                </div>
              );
            }}
          />
        </PieChart>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className={cn("tnum leading-none font-bold tracking-tight text-[#0a1440]", centerClassName)}>{centerValue}</div>
            <div className="mt-1 text-[12.5px] text-ink-3">{centerLabel}</div>
          </div>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-2">
        {slices.filter((s) => s.value > 0).map((s) => {
          const row = (
            <>
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2">{s.label}</span>
              <span className="tnum text-[13px] font-semibold text-ink">{pct(s.value / total)}</span>
            </>
          );
          return (
            <li key={s.key}>
              {onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(s.key)}
                  className="-mx-1.5 flex w-[calc(100%+0.75rem)] items-center gap-2.5 rounded-md px-1.5 py-0.5 text-left hover:bg-surface-2"
                >
                  {row}
                </button>
              ) : (
                <div className="flex items-center gap-2.5 py-0.5">{row}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
