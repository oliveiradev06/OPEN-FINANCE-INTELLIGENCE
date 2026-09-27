import type { MetricValue } from "./types";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const currencyCents = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTHS_FULL = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** R$ 12.345 */
export const brl = (value: number) => currency.format(value);

/** R$ 12.345,67 */
export const brlCents = (value: number) => currencyCents.format(value);

/** R$ 850 · R$ 28,4 mil · R$ 2,4 mi · R$ 1,3 bi */
export function brlCompact(value: number): string {
  if (Math.abs(value) < 10_000) return brl(value);
  return `${value < 0 ? "-" : ""}R$ ${compact.format(Math.abs(value))}`;
}

export const num = (value: number, digits = 0) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const numCompact = (value: number) => (Math.abs(value) < 10_000 ? num(value) : compact.format(value));

/** 0.184 -> 18% */
export const pct = (ratio: number, digits = 0) => `${num(ratio * 100, digits)}%`;

export const signedPct = (ratio: number, digits = 0) => `${ratio >= 0 ? "+" : "−"}${num(Math.abs(ratio) * 100, digits)}%`;

/** 5.4 -> 5,4% a.m. */
export const rate = (value: number) => `${num(value, value < 1 ? 2 : 1)}% a.m.`;

function toDate(iso: string): Date {
  // Plain dates ("2026-08-01") are calendar dates, not UTC instants.
  return iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso);
}

/** "2026-08-01" -> "ago/26" */
export const monthLabel = (iso: string) => {
  const d = toDate(iso);
  return `${MONTHS[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
};

/** "2026-08-01" -> "Ago" (chart ticks of a window shorter than a year) */
export const monthShort = (iso: string) => {
  const name = MONTHS[toDate(iso).getMonth()];
  return name[0].toUpperCase() + name.slice(1);
};

/** "2026-08-01" -> "agosto de 2026" */
export const monthLong = (iso: string) => {
  const d = toDate(iso);
  return `${MONTHS_FULL[d.getMonth()]} de ${d.getFullYear()}`;
};

export const dateBR = (iso: string) => toDate(iso).toLocaleDateString("pt-BR");

export const dateTimeBR = (iso: string) =>
  toDate(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function relativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - toDate(iso).getTime()) / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} ${hours === 1 ? "hora" : "horas"}`;
  const days = Math.round(hours / 24);
  if (days < 30) return `há ${days} ${days === 1 ? "dia" : "dias"}`;
  const months = Math.round(days / 30);
  return `há ${months} ${months === 1 ? "mês" : "meses"}`;
}

/** Masks all but the tail of an internal ID for dense lists: "CUS-00001" stays readable as "#00001". */
export const shortId = (id: string) => `#${id.split("-").pop()}`;

export function formatMetric(metric: MetricValue): string {
  if (typeof metric.value === "string") return metric.value;
  switch (metric.format) {
    case "currency":
      return brl(metric.value);
    case "percent":
      return pct(metric.value);
    case "rate":
      return rate(metric.value);
    default:
      return num(metric.value);
  }
}

export function initials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
