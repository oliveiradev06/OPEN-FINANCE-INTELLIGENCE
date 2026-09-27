import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "soft" | "ghost" | "success" | "ai";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-white shadow-[0_1px_2px_rgb(20_108_236/0.25)] hover:bg-primary-hover font-semibold",
  secondary: "bg-white text-ink ring-1 ring-inset ring-line-strong hover:bg-surface-2",
  soft: "bg-primary-soft text-primary-ink hover:bg-[#dce8fd] font-semibold",
  ghost: "text-ink-2 hover:bg-surface-3 hover:text-ink",
  success: "bg-accent-strong text-white hover:bg-[#077650] font-semibold",
  ai: "bg-ai-soft text-ai ring-1 ring-inset ring-ai/20 hover:bg-[#e8e1fc] font-semibold",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[12.5px] gap-1.5",
  md: "h-10 px-4 text-[13.5px] gap-2",
  lg: "h-12 px-5 text-[15px] gap-2",
};

export function buttonClass(variant: Variant = "secondary", size: Size = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center rounded-lg font-medium whitespace-nowrap transition-colors outline-none",
    "focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: React.ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
