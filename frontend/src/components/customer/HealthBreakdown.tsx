import { Meter } from "@/components/ui/Meter";
import { num, pct } from "@/lib/format";
import type { Health } from "@/lib/types";

function componentColor(score: number) {
  if (score >= 65) return "#12925c";
  if (score >= 45) return "#d98b06";
  return "#d93b3b";
}

/** Each component shows the metric behind it, its 0-100 score and the points it adds. */
export function HealthBreakdown({ health }: { health: Health }) {
  return (
    <div className="space-y-4">
      {health.components.map((c) => (
        <div key={c.key}>
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-[13.5px] font-semibold text-ink">
              {c.label} <span className="font-normal text-ink-3">· peso {pct(c.weight)}</span>
            </div>
            <div className="tnum text-[12.5px] text-ink-3">
              <span className="font-semibold text-ink">{Math.round(c.score)}</span>/100 · +{num(c.points, 1)} pts
            </div>
          </div>
          <Meter value={c.score / 100} color={componentColor(c.score)} className="mt-1.5" />
          <div className="mt-1.5 text-[12.5px] leading-snug text-ink-2">
            <span className="font-semibold text-ink">{c.display}.</span> {c.explanation}
          </div>
        </div>
      ))}
    </div>
  );
}
