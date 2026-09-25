import { ArrowRight, CircleCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ScoreRing } from "@/components/ui/Meter";
import { OpportunityTag, PriorityBadge, StatusBadge } from "@/components/ui/OpportunityTag";
import { ScoreExplain } from "@/components/ui/ScoreExplain";
import { brl } from "@/lib/format";
import { OPPORTUNITY_META } from "@/lib/labels";
import type { Opportunity } from "@/lib/types";

export function OpportunityCard({ opportunity }: { opportunity: Opportunity }) {
  const support = opportunity.evidence.filter((e) => e.kind !== "context").slice(0, 3);
  return (
    <Card className="flex h-full flex-col p-5 transition-colors hover:border-white/12">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <OpportunityTag type={opportunity.type} />
          <h3 className="mt-2 text-[15px] leading-snug font-semibold text-ink">{opportunity.title}</h3>
        </div>
        <div className="flex flex-col items-center">
          <ScoreRing value={opportunity.score} color="var(--color-accent)" size={56} stroke={5} label={`Opportunity Score ${opportunity.score}`} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <PriorityBadge priority={opportunity.priority} />
        <StatusBadge status={opportunity.status} />
        <span className="text-[12px] text-ink-3">
          Score <ScoreExplain score={opportunity.score} size="sm" title={opportunity.type_label} factors={opportunity.score_breakdown} reasons={opportunity.evidence} />
        </span>
      </div>
      <div className="mt-4">
        <div className="text-[11.5px] text-ink-3">{OPPORTUNITY_META[opportunity.type].valueLabel}</div>
        <div className="text-[22px] font-semibold tracking-tight text-ink">{brl(opportunity.estimated_value)}</div>
      </div>
      <p className="mt-2 text-[13px] leading-snug text-ink-2">{opportunity.summary}</p>
      <ul className="mt-3 space-y-1.5">
        {support.map((e) => (
          <li key={e.text} className="flex gap-2 text-[12.5px] leading-snug text-ink-2">
            {e.kind === "caution" ? (
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" />
            ) : (
              <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-accent" />
            )}
            {e.text}
          </li>
        ))}
      </ul>
      <Link
        href={`/oportunidades/${opportunity.opportunity_id}`}
        className="mt-auto inline-flex items-center gap-1 pt-4 text-[12.5px] font-medium text-accent-soft hover:text-accent"
      >
        Ver evidências completas <ArrowRight className="size-3.5" />
      </Link>
    </Card>
  );
}
