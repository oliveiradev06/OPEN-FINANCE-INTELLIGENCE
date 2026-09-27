import { cn } from "@/lib/utils";

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: React.ReactNode; count?: number }[];
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="tablist" className={cn("inline-flex flex-wrap gap-1 rounded-lg border border-line bg-surface-2 p-1", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              size === "sm" ? "px-2.5 py-1 text-[12px]" : "px-3 py-1.5 text-[12.5px]",
              active ? "bg-white text-ink shadow-[0_1px_2px_rgb(16_32_64/0.1)]" : "text-ink-3 hover:text-ink",
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span className={cn("tnum rounded px-1 text-[11px]", active ? "bg-surface-3 text-ink-2" : "text-ink-3")}>
                {option.count.toLocaleString("pt-BR")}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
