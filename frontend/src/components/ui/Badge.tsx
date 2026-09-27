import { toneStyle, type Tone } from "@/lib/tones";
import { cn } from "@/lib/utils";

/** Flat tinted pill (label + optional icon). Color is never the only carrier of meaning. */
export function Badge({
  tone = "gray",
  size = "md",
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md font-medium whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-[11.5px]" : "px-2.5 py-1 text-[12.5px] leading-[1.35]",
        className,
      )}
      style={toneStyle(tone)}
      {...props}
    >
      {children}
    </span>
  );
}

/** "+2" style counter chip, as used next to pill lists. */
export function CountChip({ count, title }: { count: number; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex h-[26px] min-w-[32px] items-center justify-center rounded-md border border-line bg-white px-1.5 text-[12px] font-semibold text-ink-2"
    >
      +{count}
    </span>
  );
}
