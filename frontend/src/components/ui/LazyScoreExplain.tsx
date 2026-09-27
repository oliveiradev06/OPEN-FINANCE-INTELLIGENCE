"use client";

import { useQuery } from "@tanstack/react-query";
import { CircleCheck } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { OPPORTUNITY_META } from "@/lib/labels";
import { useRole } from "@/lib/role";
import type { OpportunityType } from "@/lib/types";
import { HoverPopover } from "./Popover";
import { ScoreBadge } from "./ScoreExplain";

function Reasons({ customerId }: { customerId: string }) {
  const role = useRole();
  const { data, isLoading } = useQuery({
    queryKey: ["top-opportunity", customerId, role],
    queryFn: () => api.opportunities({ customer_id: customerId, page_size: 1 }),
    staleTime: 5 * 60_000,
  });
  const top = data?.items[0];
  if (isLoading) return <div className="text-[12.5px] text-ink-3">Carregando motivos…</div>;
  if (!top) return <div className="text-[12.5px] text-ink-3">Sem oportunidades ativas.</div>;
  return (
    <div className="space-y-1.5">
      <div className="text-[12.5px] leading-snug text-ink-2">{top.summary}</div>
      {top.top_evidence.map((text) => (
        <div key={text} className="flex gap-2 text-[12.5px] leading-snug text-ink-2">
          <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-accent" />
          {text}
        </div>
      ))}
    </div>
  );
}

/** Score for list rows: the explanation (top opportunity evidence) loads on first hover/focus. */
export function LazyScoreExplain({ customerId, score, type }: { customerId: string; score: number; type: OpportunityType | null }) {
  const [armed, setArmed] = useState(false);
  if (!type || score === 0) return <span className="text-[13px] text-ink-3">—</span>;
  return (
    <span onMouseEnter={() => setArmed(true)} onFocus={() => setArmed(true)}>
      <HoverPopover width={340} trigger={<ScoreBadge score={score} />}>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[12.5px] font-semibold text-ink-2">{OPPORTUNITY_META[type].label}</span>
          <span className="text-[13px] text-ink-3">
            <span className="text-[18px] font-bold text-ink">{score}</span> / 100
          </span>
        </div>
        {armed && <Reasons customerId={customerId} />}
      </HoverPopover>
    </span>
  );
}
