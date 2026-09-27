import { Sparkline } from "@/components/charts/Sparkline";
import { signedPct } from "@/lib/format";
import type { Tone } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { IconTile } from "./Avatar";
import { Card } from "./Card";

function Triangle({ down, className }: { down?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 10 10" className={cn("size-2.5 shrink-0", down && "rotate-180", className)} aria-hidden="true">
      <path d="M5 1.2 9.2 8.8H.8Z" fill="currentColor" />
    </svg>
  );
}

export type KpiDelta = { text: string; direction?: "up" | "down"; good?: boolean };

/** Headline number with a named comparison line and a tinted icon (the dashboard KPI row). */
export function KpiCard({
  label,
  value,
  icon,
  tone = "blue",
  delta,
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  tone?: Tone;
  delta?: KpiDelta;
  className?: string;
}) {
  return (
    <Card className={cn("flex items-center justify-between gap-3 px-5 py-[18px]", className)}>
      <div className="min-w-0">
        <div className="truncate text-[13.5px] text-ink-2">{label}</div>
        <div className="tnum mt-1.5 text-[30px] leading-none font-bold tracking-tight text-[#0a1440]">{value}</div>
        {delta && (
          <div
            className={cn(
              "mt-2.5 flex items-center gap-1.5 text-[12.5px] font-medium",
              delta.good === false ? "text-critical" : delta.good ? "text-accent-ink" : "text-ink-3",
            )}
          >
            {delta.direction && <Triangle down={delta.direction === "down"} />}
            <span className="truncate">{delta.text}</span>
          </div>
        )}
      </div>
      <IconTile icon={icon} tone={tone} size="lg" circle />
    </Card>
  );
}

/**
 * Compact stat tile: label · value · optional delta (vs a named period, colored by whether
 * up is good) · optional 12-point sparkline.
 */
export function StatTile({
  label,
  value,
  hint,
  delta,
  deltaLabel,
  upIsGood = true,
  trend,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  delta?: number;
  deltaLabel?: string;
  upIsGood?: boolean;
  trend?: number[];
  className?: string;
}) {
  const good = delta !== undefined && (delta >= 0) === upIsGood;
  return (
    <Card className={cn("p-4", className)}>
      <div className="text-[12.5px] font-medium text-ink-2">{label}</div>
      <div className="tnum mt-1.5 text-[22px] leading-none font-bold tracking-tight text-[#0a1440]">{value}</div>
      <div className="mt-2 flex min-h-[18px] items-center gap-2 text-[12px]">
        {delta !== undefined && (
          <span className={cn("inline-flex items-center gap-1 font-semibold", good ? "text-accent-ink" : "text-critical")}>
            <Triangle down={delta < 0} className="size-2" />
            {signedPct(delta, 1)}
          </span>
        )}
        {(deltaLabel || hint) && <span className="truncate text-ink-3">{deltaLabel ?? hint}</span>}
      </div>
      {trend && trend.length > 1 && (
        <div className="-mx-1 mt-2">
          <Sparkline data={trend} />
        </div>
      )}
    </Card>
  );
}
