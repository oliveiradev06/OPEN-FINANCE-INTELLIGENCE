"use client";

import { brl } from "@/lib/format";

type Row = { name?: string | number; value?: number | string; color?: string; dataKey?: string | number; payload?: Record<string, unknown> };

/**
 * Recharts tooltip body on a dark navy card: values lead (strong), series names follow,
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
    <div className="min-w-[150px] rounded-lg bg-[#0d2d54] px-3 py-2.5 text-white shadow-[0_12px_28px_-10px_rgb(8_27_52/0.6)]">
      {label !== undefined && <div className="mb-1.5 text-[11.5px] font-medium text-white/65">{labelFormatter ? labelFormatter(label) : label}</div>}
      <div className="space-y-1">
        {payload.map((row) => (
          <div key={String(row.dataKey ?? row.name)} className="flex items-center gap-2">
            <span className="h-[3px] w-3 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
            <span className="tnum text-[13px] font-bold">
              {typeof row.value === "number" ? valueFormatter(row.value, String(row.name)) : row.value}
            </span>
            <span className="text-[12px] text-white/70">{row.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
