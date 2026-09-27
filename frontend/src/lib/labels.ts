import {
  ArrowDownRight,
  CreditCard,
  Landmark,
  Link2,
  Percent,
  PiggyBank,
  Receipt,
  Scale,
  ShieldAlert,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Tone } from "./tones";
import type { DebtLevel, HealthBand, OpportunityStatus, OpportunityType, Priority, ProductKey, Severity } from "./types";

/**
 * Opportunity types. The color follows the type everywhere (charts, pills, icons), in the
 * validated categorical order: blue, orange, aqua, amber, magenta, violet, red.
 */
export const OPPORTUNITY_META: Record<
  OpportunityType,
  { label: string; short: string; valueLabel: string; icon: LucideIcon; tone: Tone; color: string }
> = {
  investment: { label: "Investimentos", short: "Investimentos", valueLabel: "Investido em outras instituições", icon: TrendingUp, tone: "blue", color: "#2a78d6" },
  spending_migration: { label: "Migração de gastos", short: "Cartão", valueLabel: "Volume anual em cartões concorrentes", icon: CreditCard, tone: "orange", color: "#eb6834" },
  idle_cash: { label: "Saldo parado", short: "Saldo parado", valueLabel: "Valor ocioso identificado", icon: Wallet, tone: "aqua", color: "#1baf7a" },
  debt_optimization: { label: "Otimização de dívida", short: "Dívida cara", valueLabel: "Dívida cara coberta pelo saldo", icon: Scale, tone: "amber", color: "#eda100" },
  relationship: { label: "Relacionamento", short: "Relacionamento", valueLabel: "Patrimônio em outras instituições", icon: Link2, tone: "magenta", color: "#e87ba4" },
  credit: { label: "Crédito", short: "Crédito", valueLabel: "Saldo portável", icon: Percent, tone: "violet", color: "#4a3aa7" },
  retention: { label: "Retenção", short: "Retenção", valueLabel: "Recursos em risco", icon: ShieldAlert, tone: "red", color: "#e34948" },
};

/** Color order (also the slice order of every part-to-whole chart of types). */
export const OPPORTUNITY_ORDER: OpportunityType[] = [
  "investment", "spending_migration", "idle_cash", "debt_optimization", "relationship", "credit", "retention",
];

export const STATUS_META: Record<OpportunityStatus, { label: string; tone: Tone }> = {
  new: { label: "Nova", tone: "green" },
  in_review: { label: "Em análise", tone: "blue" },
  contacted: { label: "Contatado", tone: "violet" },
  converted: { label: "Convertida", tone: "teal" },
  dismissed: { label: "Descartada", tone: "gray" },
};

export const PRIORITY_META: Record<Priority, { label: string; tone: Tone }> = {
  high: { label: "Alta", tone: "red" },
  medium: { label: "Média", tone: "amber" },
  low: { label: "Baixa", tone: "gray" },
};

/** Opportunity Score bands: >= 80 high priority, 60-79 medium, below 60 low. */
export function scoreTone(score: number): Tone {
  if (score >= 80) return "green";
  if (score >= 60) return "amber";
  return "gray";
}

export function potentialLabel(score: number): string {
  if (score >= 80) return "Alto potencial";
  if (score >= 60) return "Potencial moderado";
  if (score > 0) return "Potencial baixo";
  return "Sem oportunidade";
}

// Status palette (fixed) — always shown with a label.
export const BAND_META: Record<HealthBand, { label: string; color: string; tone: Tone }> = {
  excellent: { label: "Excelente", color: "#12925c", tone: "green" },
  healthy: { label: "Saudável", color: "#1a93a6", tone: "teal" },
  attention: { label: "Atenção", color: "#d98b06", tone: "amber" },
  critical: { label: "Crítica", color: "#d93b3b", tone: "red" },
};

export const SEVERITY_META: Record<Severity, { label: string; color: string; tone: Tone }> = {
  high: { label: "Alta", color: "#d93b3b", tone: "red" },
  medium: { label: "Média", color: "#d98b06", tone: "amber" },
  low: { label: "Baixa", color: "#6a768e", tone: "gray" },
};

export const DEBT_LEVEL_META: Record<DebtLevel, { label: string; tone: Tone }> = {
  low: { label: "Baixo", tone: "green" },
  moderate: { label: "Moderado", tone: "amber" },
  high: { label: "Alto", tone: "red" },
};

export const CONSENT_META: Record<string, { label: string; tone: Tone }> = {
  active: { label: "Ativo", tone: "green" },
  expiring: { label: "Expirando", tone: "amber" },
  revoked: { label: "Revogado", tone: "red" },
  none: { label: "Sem consentimento", tone: "gray" },
  internal: { label: "Dados internos", tone: "blue" },
};

export const PRODUCT_META: Record<ProductKey, { label: string; icon: LucideIcon }> = {
  salario: { label: "Salário", icon: ArrowDownRight },
  conta: { label: "Conta", icon: Landmark },
  cartao: { label: "Cartão", icon: CreditCard },
  investimentos: { label: "Investimentos", icon: PiggyBank },
  emprestimo: { label: "Empréstimo", icon: Receipt },
};

export const INSIGHT_CATEGORY: Record<string, string> = {
  concorrencia: "Concorrência",
  liquidez: "Liquidez",
  endividamento: "Endividamento",
  relacionamento: "Relacionamento",
  comportamento: "Comportamento",
  bem_estar: "Bem-estar financeiro",
};

export const SEGMENTS = ["Varejo", "Alta Renda", "Private"] as const;

export const ACTION_LABELS: Record<string, string> = {
  "customer.view_360": "Visualizou Customer 360",
  "customer.view_institution": "Detalhou instituição do cliente",
  "opportunity.view": "Abriu oportunidade",
  "opportunity.status_change": "Alterou status de oportunidade",
  "ai.summary": "Gerou resumo com IA",
  "ai.ask": "Perguntou à IA",
  "engine.run": "Executou o motor",
  "report.export": "Exportou relatório",
};

export const SCOPE_LABELS: Record<string, string> = {
  contas: "Contas",
  transacoes: "Transações",
  cartoes_credito: "Cartões de crédito",
  investimentos: "Investimentos",
  operacoes_credito: "Operações de crédito",
};
