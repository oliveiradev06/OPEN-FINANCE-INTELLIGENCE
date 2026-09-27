import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function FilterSelect({
  label,
  value,
  onChange,
  options,
  className,
  prefix,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
  /** Shown before the chosen option, e.g. "Ordenar por:" */
  prefix?: string;
  /** No empty "all" option: one of the options is always chosen. */
  required?: boolean;
}) {
  const plain = !!prefix || required;
  const active = value !== "" && !plain;
  return (
    <label className={cn("relative block", className)}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-10 w-full cursor-pointer appearance-none rounded-lg border bg-white pr-9 pl-3.5 text-[13.5px] font-medium text-ink outline-none transition-colors",
          "focus:border-primary/60 focus:ring-3 focus:ring-primary/10",
          active ? "border-primary/40" : "border-line-strong hover:border-[#bccadb]",
        )}
      >
        {!plain && <option value="">{label}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {prefix ? `${prefix} ${option.label}` : option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-2" />
    </label>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  className?: string;
}) {
  return (
    <label className={cn("relative block", className)}>
      <span className="sr-only">{label}</span>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-line-strong bg-white pr-3 pl-10 text-[13.5px] text-ink outline-none placeholder:text-ink-3 focus:border-primary/60 focus:ring-3 focus:ring-primary/10"
      />
    </label>
  );
}
