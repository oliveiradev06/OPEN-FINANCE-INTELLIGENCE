import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { SEVERITY_META } from "@/lib/labels";
import type { RecentSignal } from "@/lib/types";

export function SignalsFeed({ signals }: { signals: RecentSignal[] }) {
  return (
    <ul className="divide-y divide-line/70">
      {signals.map((signal) => {
        const severity = SEVERITY_META[signal.severity];
        return (
          <li key={signal.signal_id}>
            <Link
              href={`/clientes/${signal.customer_id}`}
              className="flex gap-3 px-5 py-3 transition-colors hover:bg-white/[0.025] focus-visible:bg-white/[0.04] focus-visible:outline-none"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" style={{ color: severity.color }} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-medium text-ink">{signal.title}</span>
                  <Badge className={severity.className}>{severity.label}</Badge>
                </div>
                <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-ink-3">{signal.description}</p>
                <div className="mt-1 text-[12px] text-ink-2">{signal.customer_name}</div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
