import { pct } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Emphasis part-to-whole bar: the primary bank in the accent, everything else in the
 * context gray, separated by a 2px surface gap. Shares are always printed as text.
 */
export function ShareBar({
  primaryShare,
  primaryLabel = "Banco principal",
  externalLabel = "Outras instituições",
  height = 10,
  showLegend = true,
  className,
}: {
  primaryShare: number;
  primaryLabel?: string;
  externalLabel?: string;
  height?: number;
  showLegend?: boolean;
  className?: string;
}) {
  const primary = Math.max(0, Math.min(1, primaryShare));
  const external = 1 - primary;
  return (
    <div className={className}>
      <div className="flex w-full gap-[2px]" style={{ height }} role="img" aria-label={`${primaryLabel} ${pct(primary)}, ${externalLabel} ${pct(external)}`}>
        {primary > 0 && (
          <div
            className={cn("h-full bg-accent transition-[width] duration-700", external > 0 ? "rounded-l-[4px]" : "rounded-[4px]")}
            style={{ width: `${primary * 100}%` }}
          />
        )}
        {external > 0 && (
          <div
            className={cn("h-full bg-context transition-[width] duration-700", primary > 0 ? "rounded-r-[4px]" : "rounded-[4px]")}
            style={{ width: `${external * 100}%` }}
          />
        )}
      </div>
      {showLegend && (
        <div className="mt-1.5 flex justify-between text-[12px]">
          <span className="flex items-center gap-1.5 text-ink-2">
            <span className="size-2 rounded-sm bg-accent" />
            {primaryLabel} <span className="tnum font-semibold text-ink">{pct(primary)}</span>
          </span>
          <span className="flex items-center gap-1.5 text-ink-2">
            <span className="tnum font-semibold text-ink">{pct(external)}</span> {externalLabel}
            <span className="size-2 rounded-sm bg-context" />
          </span>
        </div>
      )}
    </div>
  );
}
