/**
 * Tinted "pill" colors used by badges, tags and icon tiles. Each tone pairs a light tint with
 * an ink of the same hue that keeps >= 4.5:1 contrast on it.
 */
export type Tone = "blue" | "orange" | "aqua" | "amber" | "magenta" | "violet" | "red" | "green" | "teal" | "gray" | "navy";

export const TONES: Record<Tone, { bg: string; ink: string; solid: string }> = {
  blue: { bg: "#e5effb", ink: "#1b5aad", solid: "#2a78d6" },
  orange: { bg: "#fdece5", ink: "#b1420f", solid: "#eb6834" },
  aqua: { bg: "#dcf5ec", ink: "#0a7550", solid: "#1baf7a" },
  amber: { bg: "#fdf1d3", ink: "#865900", solid: "#eda100" },
  magenta: { bg: "#fcebf2", ink: "#ab3d69", solid: "#e87ba4" },
  violet: { bg: "#ebe9f7", ink: "#4a3aa7", solid: "#4a3aa7" },
  red: { bg: "#fde6e4", ink: "#bb2d2a", solid: "#e34948" },
  green: { bg: "#d9f3e7", ink: "#0b7550", solid: "#0f9d68" },
  teal: { bg: "#dbf1f4", ink: "#12707e", solid: "#1a93a6" },
  gray: { bg: "#eef2f7", ink: "#4a5775", solid: "#8a96ab" },
  navy: { bg: "#e3e9f4", ink: "#223f73", solid: "#2a4f8f" },
};

export function toneStyle(tone: Tone): React.CSSProperties {
  return { backgroundColor: TONES[tone].bg, color: TONES[tone].ink };
}
