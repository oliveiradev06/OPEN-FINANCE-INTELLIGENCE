import { ArrowRight, CircleCheck, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { brl, signedPct } from "@/lib/format";
import { SEVERITY_META } from "@/lib/labels";
import type { Signal } from "@/lib/types";

export function SignalsList({ signals }: { signals: Signal[] }) {
  if (signals.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-line bg-white/[0.02] px-4 py-5 text-[13px] text-ink-2">
        <CircleCheck className="size-4 text-accent" />
        Nenhuma mudança relevante de comportamento no último trimestre.
      </div>
    );
  }
  return (
    <ul className="space-y-2.5">
      {signals.map((s) => {
        const severity = SEVERITY_META[s.severity];
        const money = s.metric_before !== null && s.metric_after !== null && Math.abs(s.metric_before) > 1;
        return (
          <li key={s.signal_id} className="rounded-lg border border-line bg-white/[0.02] p-3.5">
            <div className="flex items-start gap-3">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" style={{ color: severity.color }} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[13.5px] font-medium text-ink">{s.title}</span>
                  <Badge className={severity.className}>Severidade {severity.label.toLowerCase()}</Badge>
                </div>
                <p className="mt-1 text-[12.5px] leading-snug text-ink-2">{s.description}</p>
                {money && (
                  <div className="tnum mt-2 flex items-center gap-2 text-[12px] text-ink-3">
                    {brl(s.metric_before!)} <ArrowRight className="size-3" /> <span className="font-medium text-ink">{brl(s.metric_after!)}</span>
                    {s.change_pct !== null && <span>({signedPct(s.change_pct)})</span>}
                  </div>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
