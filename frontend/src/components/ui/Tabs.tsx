import { num } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Underlined tabs; counts render as "Label (1.234)". */
export function Tabs<T extends string>({
  value,
  onChange,
  items,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  items: { value: T; label: React.ReactNode; count?: number; title?: string }[];
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("flex gap-1 overflow-x-auto border-b border-line", className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            title={item.title}
            onClick={() => onChange(item.value)}
            className={cn(
              "relative -mb-px shrink-0 px-3.5 pt-2.5 pb-3 text-[14px] whitespace-nowrap transition-colors outline-none focus-visible:bg-surface-2",
              active ? "font-semibold text-primary-ink" : "font-medium text-ink-2 hover:text-ink",
            )}
          >
            {item.label}
            {item.count !== undefined && <span className="tnum"> ({num(item.count)})</span>}
            {active && <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-primary" />}
          </button>
        );
      })}
    </div>
  );
}
