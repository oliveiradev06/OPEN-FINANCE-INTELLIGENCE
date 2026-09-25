import { OPPORTUNITY_META, PRIORITY_META, STATUS_META } from "@/lib/labels";
import type { OpportunityStatus, OpportunityType, Priority } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "./Badge";

export function OpportunityIcon({ type, className }: { type: OpportunityType; className?: string }) {
  const Icon = OPPORTUNITY_META[type].icon;
  return <Icon className={cn("size-4 text-ink-3", className)} aria-hidden="true" />;
}

/** Opportunity type: identity via icon + label (never color alone). */
export function OpportunityTag({ type, className, short }: { type: OpportunityType; className?: string; short?: boolean }) {
  const meta = OPPORTUNITY_META[type];
  const Icon = meta.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[12.5px] whitespace-nowrap text-ink-2", className)}>
      <span className="grid size-5 place-items-center rounded-md bg-white/[0.06] ring-1 ring-white/10">
        <Icon className="size-3 text-ink-2" aria-hidden="true" />
      </span>
      {short ? meta.short : meta.label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const meta = PRIORITY_META[priority];
  return <Badge className={meta.className}>Prioridade {meta.label.toLowerCase()}</Badge>;
}

export function StatusBadge({ status }: { status: OpportunityStatus }) {
  const meta = STATUS_META[status];
  return <Badge className={meta.className}>{meta.label}</Badge>;
}
