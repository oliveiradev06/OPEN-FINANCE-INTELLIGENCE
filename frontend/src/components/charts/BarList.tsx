import { cn } from "@/lib/utils";

export type BarListItem = {
  key: string;
  label: React.ReactNode;
  value: number;
  display: React.ReactNode;
  secondary?: React.ReactNode;
  highlight?: boolean;
  href?: string;
};

/**
 * Horizontal bars for nominal categories: one series, one hue (never colored by value),
 * on a light track. Values are printed next to each bar, so the chart is its own table.
 */
export function BarList({
  items,
  color = "var(--color-primary)",
  highlightColor = "var(--color-accent)",
  className,
  onSelect,
}: {
  items: BarListItem[];
  color?: string;
  highlightColor?: string;
  className?: string;
  onSelect?: (key: string) => void;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className={cn("space-y-3", className)}>
      {items.map((item) => {
        const width = Math.max((item.value / max) * 100, 1.5);
        const content = (
          <>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
              <span className="min-w-0 truncate text-ink">{item.label}</span>
              {item.secondary && <span className="tnum shrink-0 text-[12px] text-ink-3">{item.secondary}</span>}
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2.5 flex-1 overflow-hidden rounded-[3px] bg-[#e8eef7]">
                <div
                  className="h-full rounded-[3px] transition-[width] duration-700"
                  style={{ width: `${width}%`, backgroundColor: item.highlight ? highlightColor : color }}
                />
              </div>
              <span className="tnum w-[96px] shrink-0 text-right text-[13px] font-semibold text-ink">{item.display}</span>
            </div>
          </>
        );
        return (
          <li key={item.key}>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(item.key)}
                className="-mx-2 block w-[calc(100%+1rem)] rounded-lg px-2 py-1 text-left transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
              >
                {content}
              </button>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ul>
  );
}
