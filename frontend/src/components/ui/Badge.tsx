import { cn } from "@/lib/utils";

export function Badge({ className, children, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap ring-1 ring-inset",
        "bg-white/5 text-ink-2 ring-white/10",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
