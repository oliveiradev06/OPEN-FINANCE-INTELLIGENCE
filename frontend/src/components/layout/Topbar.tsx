"use client";

import { CalendarDays, Cpu } from "lucide-react";
import { useMeta } from "@/lib/hooks";
import { monthLabel, relativeTime } from "@/lib/format";
import { GlobalSearch } from "./GlobalSearch";

export function Topbar({ leading }: { leading?: React.ReactNode }) {
  const { data: meta } = useMeta();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-page/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1480px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        {leading}
        <GlobalSearch />
        <div className="ml-auto hidden items-center gap-2 lg:flex">
          {meta?.reference_month && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-[12px] whitespace-nowrap text-ink-2">
              <CalendarDays className="size-3.5 text-ink-3" />
              Dados até <span className="font-medium text-ink">{monthLabel(meta.reference_month)}</span>
            </span>
          )}
          {meta?.last_run?.finished_at && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-[12px] whitespace-nowrap text-ink-2"
              title={`Execução ${meta.last_run.run_id} · motor v${meta.last_run.engine_version}`}
            >
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent/60" />
                <span className="relative inline-flex size-2 rounded-full bg-accent" />
              </span>
              <Cpu className="size-3.5 text-ink-3" />
              Motor executado {relativeTime(meta.last_run.finished_at)}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
