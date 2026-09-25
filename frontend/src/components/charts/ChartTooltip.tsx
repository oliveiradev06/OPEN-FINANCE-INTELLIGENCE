"use client";

import { brl } from "@/lib/format";

type Row = { name?: string | number; value?: number | string; color?: string; dataKey?: string | number; payload?: Record<string, unknown> };

/**
 * Recharts tooltip body: values lead (strong), series names follow (secondary),
 * each row keyed by a short line in the series color.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter = (v: number) => brl(v),
}: {
  active?: boolean;
  payload?: Row[];
  label?: string | number;
  labelFormatter?: (label: string | number) => string;
  valueFormatter?: (value: number, name?: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[160px] rounded-lg border border-line-strong bg-[#0f1729]/95 px-3 py-2.5 shadow-xl shadow-black/50 backdrop-blur">
      {label !== undefined && (
        <div className="mb-1.5 text-[11.5px] font-medium text-ink-3">{labelFormatter ? labelFormatter(label) : label}</div>
      )}
      <div className="space-y-1">
        {payload.map((row) => (
          <div key={String(row.dataKey ?? row.name)} className="flex items-center gap-2">
            <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
            <span className="tnum text-[13px] font-semibold text-ink">
              {typeof row.value === "number" ? valueFormatter(row.value, String(row.name)) : row.value}
            </span>
            <span className="text-[12px] text-ink-3">{row.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
