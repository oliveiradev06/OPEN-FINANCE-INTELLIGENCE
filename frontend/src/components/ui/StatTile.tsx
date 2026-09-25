import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Sparkline } from "@/components/charts/Sparkline";
import { signedPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card } from "./Card";

/**
 * Stat tile contract: label · value · optional delta (vs a named period, colored by whether
 * up is good) · optional 12-point sparkline.
 */
export function StatTile({
  label,
  value,
  hint,
  icon,
  delta,
  deltaLabel,
  upIsGood = true,
  trend,
  className,
  emphasis,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  delta?: number;
  deltaLabel?: string;
  upIsGood?: boolean;
  trend?: number[];
  className?: string;
  emphasis?: boolean;
}) {
  const good = delta !== undefined && (delta >= 0) === upIsGood;
  return (
    <Card className={cn("relative overflow-hidden p-4", emphasis && "border-accent/25", className)}>
      {emphasis && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/70 to-transparent" />
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-medium text-ink-2">{label}</span>
        {icon && <span className="text-ink-3">{icon}</span>}
      </div>
      <div className="mt-2 text-[26px] leading-none font-semibold tracking-tight text-ink">{value}</div>
      <div className="mt-2 flex min-h-[18px] items-center gap-2 text-[12px]">
        {delta !== undefined && (
          <span className={cn("inline-flex items-center gap-0.5 font-medium", good ? "text-[#5fd35f]" : "text-[#f07171]")}>
            {delta >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
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
