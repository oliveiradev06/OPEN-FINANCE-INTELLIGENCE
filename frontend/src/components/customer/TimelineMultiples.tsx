"use client";

import { AreaTrend } from "@/components/charts/AreaTrend";
import { brl, monthLabel, signedPct } from "@/lib/format";
import type { TimelinePoint } from "@/lib/types";
import { cn } from "@/lib/utils";

const SERIES: { key: string; title: string; value: (t: TimelinePoint) => number; upIsGood: boolean }[] = [
  { key: "net_worth", title: "Patrimônio líquido", value: (t) => t.net_worth, upIsGood: true },
  { key: "balance", title: "Saldo em conta", value: (t) => t.balance_primary + t.balance_external, upIsGood: true },
  { key: "investments", title: "Investimentos", value: (t) => t.investments_primary + t.investments_external, upIsGood: true },
  { key: "debt", title: "Dívidas", value: (t) => t.debt_total, upIsGood: false },
  { key: "expenses", title: "Gastos mensais", value: (t) => t.expenses, upIsGood: false },
];

/**
 * Small multiples instead of one crowded chart: each measure keeps its own scale,
 * so there is never a second y-axis.
 */
export function TimelineMultiples({ timeline }: { timeline: TimelinePoint[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {SERIES.map((series) => {
        const values = timeline.map(series.value);
        const first = values[0] ?? 0;
        const last = values[values.length - 1] ?? 0;
        const change = first !== 0 ? last / first - 1 : 0;
        const good = (change >= 0) === series.upIsGood;
        return (
          <div key={series.key} className="rounded-xl border border-line bg-white p-4 shadow-card">
            <div className="text-[12.5px] font-medium text-ink-2">{series.title}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="tnum text-[17px] font-bold text-[#0a1440]">{brl(last)}</span>
              {first !== 0 && Math.abs(change) > 0.005 && (
                <span className={cn("text-[11.5px] font-semibold", good ? "text-accent-ink" : "text-critical")}>{signedPct(change)}</span>
              )}
            </div>
            <div className="text-[11.5px] text-ink-3">vs. {timeline[0] ? monthLabel(timeline[0].month) : "—"}</div>
            <div className="-mx-1 mt-2">
              <AreaTrend
                id={`tl-${series.key}`}
                name={series.title}
                data={timeline.map((t) => ({ label: monthLabel(t.month), value: series.value(t) }))}
                height={96}
                axes={false}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
