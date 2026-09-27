import { ArrowUp, ChartColumnIncreasing, FileClock, TriangleAlert, UsersRound } from "lucide-react";
import Link from "next/link";
import { IconTile } from "@/components/ui/Avatar";
import { relativeTime } from "@/lib/format";
import type { ActivityItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONS = {
  connections: ArrowUp,
  opportunities: ChartColumnIncreasing,
  priority: UsersRound,
  alerts: TriangleAlert,
  consents: FileClock,
};

/** "Movimentações relevantes": every row links to the customers or opportunities behind it. */
export function ActivityFeed({ items, compact, onNavigate }: { items: ActivityItem[]; compact?: boolean; onNavigate?: () => void }) {
  return (
    <ul className="divide-y divide-line">
      {items.map((item) => (
        <li key={item.kind}>
          <Link
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none",
              compact ? "px-3 py-2.5" : "px-5 py-3",
            )}
          >
            <IconTile icon={ICONS[item.kind]} tone={item.tone} size={compact ? "sm" : "md"} className="rounded-xl" />
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] leading-snug font-medium text-ink">{item.title}</div>
              <div className="truncate text-[12px] text-ink-3">{item.detail}</div>
            </div>
            <span className="shrink-0 text-[12px] whitespace-nowrap text-ink-3">{relativeTime(item.timestamp)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
