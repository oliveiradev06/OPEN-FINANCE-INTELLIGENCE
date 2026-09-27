import { OPPORTUNITY_META, PRIORITY_META, STATUS_META } from "@/lib/labels";
import { TONES } from "@/lib/tones";
import type { OpportunityStatus, OpportunityType, Priority } from "@/lib/types";
import { cn } from "@/lib/utils";
import { IconTile } from "./Avatar";
import { Badge, CountChip } from "./Badge";

export function OpportunityIcon({ type, className }: { type: OpportunityType; className?: string }) {
  const meta = OPPORTUNITY_META[type];
  const Icon = meta.icon;
  return <Icon className={cn("size-4", className)} style={{ color: TONES[meta.tone].ink }} aria-hidden="true" />;
}

/** Opportunity type as a tinted pill: the type's color plus its name (never color alone). */
export function OpportunityPill({ type, short, icon, size }: { type: OpportunityType; short?: boolean; icon?: boolean; size?: "sm" | "md" }) {
  const meta = OPPORTUNITY_META[type];
  const Icon = meta.icon;
  return (
    <Badge tone={meta.tone} size={size}>
      {icon && <Icon className="size-3.5" aria-hidden="true" />}
      {short ? meta.short : meta.label}
    </Badge>
  );
}

/** First types as pills, the rest folded into a "+N" chip (as in the reference tables). */
export function OpportunityPills({ types, max = 2 }: { types: OpportunityType[]; max?: number }) {
  if (types.length === 0) return <span className="text-[13px] text-ink-3">—</span>;
  const rest = types.slice(max);
  return (
    <span className="flex items-center gap-1.5">
      {types.slice(0, max).map((type) => (
        <OpportunityPill key={type} type={type} short />
      ))}
      {rest.length > 0 && <CountChip count={rest.length} title={rest.map((t) => OPPORTUNITY_META[t].label).join(", ")} />}
    </span>
  );
}

/** Small colored tile per opportunity type (compact list cells). */
export function OpportunityTiles({ types }: { types: OpportunityType[] }) {
  if (types.length === 0) return <span className="text-[13px] text-ink-3">—</span>;
  return (
    <span className="flex items-center gap-1.5">
      {types.slice(0, 4).map((type) => (
        <IconTile key={type} icon={OPPORTUNITY_META[type].icon} tone={OPPORTUNITY_META[type].tone} size="xs" title={OPPORTUNITY_META[type].label} className="rounded-md" />
      ))}
      {types.length > 4 && <span className="text-[11.5px] font-semibold text-ink-3">+{types.length - 4}</span>}
    </span>
  );
}

/** Legacy name kept for the pages that show type + label inline. */
export function OpportunityTag({ type, short, className }: { type: OpportunityType; short?: boolean; className?: string }) {
  const meta = OPPORTUNITY_META[type];
  return (
    <span className={cn("inline-flex items-center gap-2 text-[13px] font-medium whitespace-nowrap text-ink", className)}>
      <IconTile icon={meta.icon} tone={meta.tone} size="xs" className="rounded-md" />
      {short ? meta.short : meta.label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const meta = PRIORITY_META[priority];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function StatusBadge({ status }: { status: OpportunityStatus }) {
  const meta = STATUS_META[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
