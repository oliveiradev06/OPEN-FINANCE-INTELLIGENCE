import { useId } from "react";
import { cn } from "@/lib/utils";

/** Circular meter for 0-100 scores. The unfilled track is a light step of the same color. */
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
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeOpacity={0.15} strokeWidth={stroke} />
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
      <span className="absolute font-bold text-[#0a1440]" style={{ fontSize: size * 0.3 }}>
        {Math.round(clamped)}
      </span>
    </div>
  );
}

function polar(cx: number, cy: number, r: number, degrees: number) {
  const rad = (degrees * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arc(cx: number, cy: number, r: number, from: number, to: number) {
  const start = polar(cx, cy, r, from);
  const end = polar(cx, cy, r, to);
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${end.x} ${end.y}`;
}

/** 270° gauge (open at the bottom) with the value in the middle, e.g. "87 de 100". */
export function Gauge({
  value,
  size = 168,
  stroke = 16,
  colors = ["#3cc583", "#15a06a", "#0b6b5e"],
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  colors?: [string, string, string];
  label?: string;
}) {
  const gradient = `gauge-${useId().replace(/:/g, "")}`;
  const clamped = Math.max(0, Math.min(100, value));
  const c = size / 2;
  const r = c - stroke / 2 - 1;
  const start = 135;
  const end = start + 270 * (clamped / 100);
  return (
    <div role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={clamped} aria-label={label} className="relative inline-block" style={{ width: size, height: size * 0.86 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute top-0 left-0">
        <defs>
          <linearGradient id={gradient} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor={colors[0]} />
            <stop offset="0.5" stopColor={colors[1]} />
            <stop offset="1" stopColor={colors[2]} />
          </linearGradient>
        </defs>
        <path d={arc(c, c, r, start, start + 270)} fill="none" stroke="#e5f3ec" strokeWidth={stroke} strokeLinecap="round" />
        {clamped > 0 && (
          <path d={arc(c, c, r, start, end)} fill="none" stroke={`url(#${gradient})`} strokeWidth={stroke} strokeLinecap="round" />
        )}
      </svg>
      <div className="absolute inset-x-0 text-center" style={{ top: c - 26 }}>
        <div className="tnum text-[38px] leading-none font-bold text-[#0a1440]">{Math.round(clamped)}</div>
        <div className="mt-1 text-[12.5px] text-ink-3">de 100</div>
      </div>
    </div>
  );
}

/** Horizontal meter on a light track of the same color. */
export function Meter({ value, color = "var(--color-primary)", className, height = 6 }: { value: number; color?: string; className?: string; height?: number }) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div
      className={cn("w-full overflow-hidden rounded-full", className)}
      style={{ height, backgroundColor: `color-mix(in oklab, ${color} 14%, white)` }}
    >
      <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${clamped * 100}%`, backgroundColor: color }} />
    </div>
  );
}
