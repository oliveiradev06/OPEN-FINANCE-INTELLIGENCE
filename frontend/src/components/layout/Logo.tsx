import { cn } from "@/lib/utils";

// Pointy-top hexagon ring split in six faces, like a cube seen from above: many sources, one view.
const FACES = [
  { d: "M20 2 35.59 11 26.93 16 20 12Z", fill: "#62c0f2" },
  { d: "M35.59 11 35.59 29 26.93 24 26.93 16Z", fill: "#2a86e8" },
  { d: "M35.59 29 20 38 20 28 26.93 24Z", fill: "#1d6fd8" },
  { d: "M20 38 4.41 29 13.07 24 20 28Z", fill: "#58b6ef" },
  { d: "M4.41 29 4.41 11 13.07 16 13.07 24Z", fill: "#2d6fb3" },
  { d: "M4.41 11 20 2 20 12 13.07 16Z", fill: "url(#ofi-logo-top)" },
];

export function LogoMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="ofi-logo-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#46d6a4" />
          <stop offset="1" stopColor="#27b58f" />
        </linearGradient>
      </defs>
      {FACES.map((face) => (
        <path key={face.d} d={face.d} fill={face.fill} />
      ))}
    </svg>
  );
}

export function Brand({ size = "md", className }: { size?: "md" | "lg"; className?: string }) {
  return (
    <span className={cn("flex items-center", size === "lg" ? "gap-4" : "gap-3", className)}>
      <LogoMark className={size === "lg" ? "size-14" : "size-9"} />
      <span className={cn("leading-[1.15] text-white", size === "lg" ? "text-[22px]" : "text-[15px]")}>
        <span className="block font-semibold tracking-tight">OpenFinance</span>
        <span className="block font-medium text-white/90">Intelligence</span>
      </span>
    </span>
  );
}
