import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function FilterSelect({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  const active = value !== "";
  return (
    <label className={cn("relative block", className)}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-9 w-full cursor-pointer appearance-none rounded-lg border bg-surface pr-8 pl-3 text-[12.5px] outline-none transition-colors",
          "focus:border-accent/50",
          active ? "border-accent/40 text-ink" : "border-line text-ink-2 hover:border-line-strong",
        )}
      >
        <option value="">{label}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-ink-3" />
    </label>
  );
}
