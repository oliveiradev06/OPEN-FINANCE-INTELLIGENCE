import { initials } from "@/lib/format";
import { toneStyle, type Tone } from "@/lib/tones";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "size-8 text-[11px]",
  md: "size-9 text-[12px]",
  lg: "size-14 text-[19px]",
  xl: "size-16 text-[21px]",
};

/** Initials in a circle: dark slate in lists, light gray in headers, blue for the signed-in user. */
export function Avatar({
  name,
  size = "sm",
  variant = "dark",
  className,
}: {
  name: string;
  size?: keyof typeof SIZES;
  variant?: "dark" | "light" | "brand";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-semibold tracking-tight",
        SIZES[size],
        variant === "dark" && "bg-[#34486b] text-white",
        variant === "light" && "bg-[#e7ecf3] text-[#23324f] ring-1 ring-[#dbe2ec]",
        variant === "brand" && "bg-[#1565d8] text-white",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

const TILE_SIZES = {
  xs: "size-6 [&>svg]:size-3.5",
  sm: "size-8 [&>svg]:size-4",
  md: "size-10 [&>svg]:size-5",
  lg: "size-12 [&>svg]:size-[22px]",
  xl: "size-14 [&>svg]:size-6",
};

/** Icon on a tinted tile (rounded square or circle). */
export function IconTile({
  icon: Icon,
  tone = "blue",
  size = "md",
  circle,
  className,
  title,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  tone?: Tone;
  size?: keyof typeof TILE_SIZES;
  circle?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn("inline-grid shrink-0 place-items-center", circle ? "rounded-full" : "rounded-lg", TILE_SIZES[size], className)}
      style={toneStyle(tone)}
    >
      <Icon aria-hidden />
    </span>
  );
}
