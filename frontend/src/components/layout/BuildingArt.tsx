import { useId } from "react";

// Fixed "random" layouts, so the server and the browser render the same picture.
const FOLIAGE: [number, number, number, number][] = [
  // cx, cy, r, shade (0 dark .. 3 light)
  [700, 700, 46, 1], [742, 668, 52, 2], [790, 690, 50, 1], [668, 742, 40, 0], [720, 736, 44, 2],
  [770, 740, 46, 1], [812, 730, 40, 0], [745, 620, 40, 3], [700, 640, 34, 2], [790, 630, 36, 2],
  [640, 790, 34, 1], [690, 790, 38, 0], [742, 790, 42, 1], [795, 790, 40, 2], [610, 820, 26, 0],
  [655, 830, 30, 2], [720, 836, 32, 1], [770, 832, 34, 0], [812, 820, 30, 1], [760, 595, 26, 3],
  [722, 700, 24, 3], [680, 690, 22, 3], [805, 665, 24, 3], [640, 760, 22, 3],
];
const SHADES = ["#153d29", "#1f5a3a", "#2c7148", "#3f8a56"];

/**
 * Glass office tower at dusk, drawn in SVG (no photo assets): used behind the login copy and,
 * faded, at the foot of the sidebar.
 */
export function BuildingArt({ variant = "hero", className }: { variant?: "hero" | "sidebar"; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const id = (name: string) => `${uid}-${name}`;
  const hero = variant === "hero";

  return (
    <svg viewBox="0 0 800 1000" preserveAspectRatio={hero ? "xMidYMid slice" : "xMidYMax slice"} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id("sky")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b2542" />
          <stop offset="0.45" stopColor="#1a4f84" />
          <stop offset="0.78" stopColor="#10345c" />
          <stop offset="1" stopColor="#071a2f" />
        </linearGradient>
        <radialGradient id={id("glow")} cx="0.82" cy="0.08" r="0.6">
          <stop offset="0" stopColor="#9fd0ff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#9fd0ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id("front")} x1="0" y1="0" x2="1" y2="0.25">
          <stop offset="0" stopColor="#2d6aab" />
          <stop offset="0.5" stopColor="#1b5088" />
          <stop offset="1" stopColor="#123b67" />
        </linearGradient>
        <linearGradient id={id("side")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#10325a" />
          <stop offset="1" stopColor="#0a2240" />
        </linearGradient>
        <linearGradient id={id("sheen")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.26" />
          <stop offset="0.28" stopColor="#ffffff" stopOpacity="0.03" />
          <stop offset="0.52" stopColor="#ffffff" stopOpacity="0.14" />
          <stop offset="0.62" stopColor="#ffffff" stopOpacity="0.02" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <pattern id={id("pane")} width="30" height="34" patternUnits="userSpaceOnUse">
          <rect width="30" height="34" fill="#0d2a4a" fillOpacity="0.55" />
          <rect x="1.2" y="1.2" width="27.6" height="31.6" fill="#4d8ccb" fillOpacity="0.34" />
          <rect x="1.2" y="1.2" width="27.6" height="4" fill="#b8dcff" fillOpacity="0.22" />
          <rect x="1.2" y="20" width="27.6" height="12.8" fill="#0b2340" fillOpacity="0.18" />
        </pattern>
        <pattern id={id("pane-dim")} width="26" height="30" patternUnits="userSpaceOnUse">
          <rect width="26" height="30" fill="#0a2240" fillOpacity="0.5" />
          <rect x="1.2" y="1.2" width="23.6" height="27.6" fill="#3a74b0" fillOpacity="0.24" />
        </pattern>
        <linearGradient id={id("ground")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#15395f" />
          <stop offset="1" stopColor="#061425" />
        </linearGradient>
        <linearGradient id={id("fade")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.35" stopColor="#ffffff" stopOpacity="1" />
        </linearGradient>
        <mask id={id("mask")}>
          <rect width="800" height="1000" fill={hero ? "#ffffff" : `url(#${id("fade")})`} />
        </mask>
      </defs>

      <g mask={`url(#${id("mask")})`}>
        {hero && <rect width="800" height="1000" fill={`url(#${id("sky")})`} />}
        {hero && <rect width="800" height="1000" fill={`url(#${id("glow")})`} />}

        {/* back building */}
        <path d="M110 430 330 390V890H110Z" fill="#133d6a" />
        <path d="M110 430 330 390V890H110Z" fill={`url(#${id("pane-dim")})`} />

        {/* main tower: glass curtain wall, reflections and a darker side face */}
        <path d="M300 190 700 105V890H300Z" fill={`url(#${id("front")})`} />
        <path d="M300 190 700 105V890H300Z" fill={`url(#${id("pane")})`} />
        <path d="M300 190 700 105V890H300Z" fill={`url(#${id("sheen")})`} />
        <path d="M300 520 700 330V420L300 610Z" fill="#ffffff" fillOpacity="0.05" />
        <path d="M700 105 800 135V890H700Z" fill={`url(#${id("side")})`} />
        <path d="M700 105 800 135V890H700Z" fill={`url(#${id("pane-dim")})`} />
        <path d="M300 190 700 105 800 135" fill="none" stroke="#a9d3fa" strokeOpacity="0.4" strokeWidth="2" />
        <path d="M700 105V890" stroke="#9cc8f2" strokeOpacity="0.25" strokeWidth="1.5" />

        {/* lit lobby */}
        <rect x="300" y="775" width="400" height="115" fill="#0b223d" />
        {Array.from({ length: 9 }).map((_, i) => (
          <rect key={i} x={318 + i * 42} y="800" width="28" height="70" fill="#f4c27a" fillOpacity={hero ? 0.55 : 0.25} />
        ))}
        <rect x="288" y="764" width="424" height="12" fill="#081a30" />

        {hero && (
          <>
            {/* trees: many overlapping crowns instead of one blob */}
            <path d="M735 900V780M690 900V805M780 900V790" stroke="#10261a" strokeWidth="8" />
            {FOLIAGE.map(([cx, cy, r, shade], i) => (
              <circle key={i} cx={cx} cy={cy} r={r} fill={SHADES[shade]} fillOpacity={0.96} />
            ))}
            {FOLIAGE.filter(([, , , shade]) => shade >= 2).map(([cx, cy, r], i) => (
              <circle key={`hl-${i}`} cx={cx - r * 0.25} cy={cy - r * 0.3} r={r * 0.45} fill="#5aa46c" fillOpacity={0.35} />
            ))}
            <rect x="230" y="866" width="600" height="30" rx="15" fill="#1a4a30" />
            <rect x="230" y="866" width="600" height="8" rx="4" fill="#2d6b45" fillOpacity="0.6" />
          </>
        )}

        {/* ground and road reflections */}
        <rect y="890" width="800" height="110" fill={`url(#${id("ground")})`} />
        <rect y="930" width="800" height="3" fill="#3a6fa6" fillOpacity="0.25" />
        <rect y="965" width="800" height="2" fill="#3a6fa6" fillOpacity="0.18" />
      </g>
    </svg>
  );
}
