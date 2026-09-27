import { Clock3, SignalHigh, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { CONSENT_META } from "@/lib/labels";
import type { ConsentStatus } from "@/lib/types";

const ICONS: Record<ConsentStatus, typeof SignalHigh> = { active: SignalHigh, expiring: Clock3, revoked: X, none: X };

/** Open Finance sharing status of a customer: expiring beats active because it needs action. */
export function ConsentPill({ status }: { status: ConsentStatus }) {
  const meta = CONSENT_META[status];
  const Icon = ICONS[status];
  return (
    <Badge tone={meta.tone}>
      <Icon className="size-3.5" /> {meta.label}
    </Badge>
  );
}
