import { cn } from "@/lib/utils";

/** Circular meter for 0-100 scores. The unfilled track is a lighter step of the same color. */
export function ScoreRing({
  value,
  color,
  size = 72,
  stroke = 6,
  label,
  className,
}: {
  value: number;
  color: string;
  size?: number;
  stroke?: number;
  label?: string;
  className?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-label={label}
      className={cn("relative inline-grid place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeOpacity={0.16} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.2, 0.7, 0.2, 1)" }}
        />
      </svg>
      <span className="absolute text-center leading-none">
        <span className="font-semibold text-ink" style={{ fontSize: size * 0.3 }}>
          {Math.round(clamped)}
        </span>
      </span>
    </div>
  );
}

/** Horizontal meter (same-ramp track). */
export function Meter({ value, color = "var(--color-blue)", className }: { value: number; color?: string; className?: string }) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full", className)} style={{ backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)` }}>
      <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${clamped * 100}%`, backgroundColor: color }} />
    </div>
  );
}
