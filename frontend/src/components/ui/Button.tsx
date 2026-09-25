import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "ai";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-[#04110c] hover:bg-accent-soft font-semibold",
  secondary: "bg-surface-2 text-ink ring-1 ring-inset ring-line-strong hover:bg-surface-3",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  ai: "bg-violet/15 text-[#c9c3f7] ring-1 ring-inset ring-violet/30 hover:bg-violet/25",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[12.5px] gap-1.5",
  md: "h-9 px-4 text-[13px] gap-2",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition-colors outline-none",
        "focus-visible:ring-2 focus-visible:ring-accent/60 disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
