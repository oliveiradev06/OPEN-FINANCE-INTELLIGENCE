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
import type { DebtLevel, HealthBand, OpportunityStatus, OpportunityType, Priority, ProductKey, Severity } from "./types";

export const OPPORTUNITY_META: Record<OpportunityType, { label: string; short: string; valueLabel: string; icon: LucideIcon }> = {
  investment: { label: "Investimentos", short: "Investimentos", valueLabel: "Investido em outras instituições", icon: TrendingUp },
  idle_cash: { label: "Saldo parado", short: "Saldo parado", valueLabel: "Valor ocioso identificado", icon: Wallet },
  debt_optimization: { label: "Otimização de dívida", short: "Dívida cara", valueLabel: "Dívida cara coberta pelo saldo", icon: Scale },
  credit: { label: "Crédito", short: "Portabilidade", valueLabel: "Saldo portável", icon: Percent },
  relationship: { label: "Relacionamento", short: "Relacionamento", valueLabel: "Patrimônio em outras instituições", icon: Link2 },
  retention: { label: "Retenção", short: "Retenção", valueLabel: "Recursos em risco", icon: ShieldAlert },
  spending_migration: { label: "Migração de gastos", short: "Cartão concorrente", valueLabel: "Volume anual em cartões concorrentes", icon: CreditCard },
};

export const OPPORTUNITY_ORDER: OpportunityType[] = [
  "investment", "idle_cash", "debt_optimization", "credit", "relationship", "retention", "spending_migration",
];

export const STATUS_META: Record<OpportunityStatus, { label: string; className: string }> = {
  new: { label: "Nova", className: "bg-blue/12 text-[#8fb9f0] ring-blue/25" },
  in_review: { label: "Em análise", className: "bg-violet/12 text-[#b9b1f3] ring-violet/25" },
  contacted: { label: "Cliente contatado", className: "bg-accent/12 text-accent-soft ring-accent/25" },
  converted: { label: "Convertida", className: "bg-good/15 text-[#5fd35f] ring-good/30" },
  dismissed: { label: "Descartada", className: "bg-white/5 text-ink-3 ring-white/10" },
};

export const PRIORITY_META: Record<Priority, { label: string; className: string }> = {
  high: { label: "Alta", className: "bg-accent/14 text-accent-soft ring-accent/30" },
  medium: { label: "Média", className: "bg-blue/12 text-[#8fb9f0] ring-blue/25" },
  low: { label: "Baixa", className: "bg-white/5 text-ink-2 ring-white/10" },
};

// Status palette (fixed): good / warning / serious / critical — always shown with a label.
export const BAND_META: Record<HealthBand, { label: string; color: string; text: string }> = {
  excellent: { label: "Excelente", color: "var(--color-good)", text: "text-[#5fd35f]" },
  healthy: { label: "Saudável", color: "var(--color-good)", text: "text-[#5fd35f]" },
  attention: { label: "Atenção", color: "var(--color-warning)", text: "text-warning" },
  critical: { label: "Crítica", color: "var(--color-critical)", text: "text-[#f07171]" },
};

export const SEVERITY_META: Record<Severity, { label: string; color: string; className: string }> = {
  high: { label: "Alta", color: "var(--color-critical)", className: "bg-critical/15 text-[#f07171] ring-critical/30" },
  medium: { label: "Média", color: "var(--color-warning)", className: "bg-warning/12 text-warning ring-warning/25" },
  low: { label: "Baixa", color: "var(--color-ink-3)", className: "bg-white/5 text-ink-2 ring-white/10" },
};

export const DEBT_LEVEL_META: Record<DebtLevel, { label: string; className: string }> = {
  low: { label: "Baixo", className: "text-ink-2" },
  moderate: { label: "Moderado", className: "text-warning" },
  high: { label: "Alto", className: "text-[#f07171]" },
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
};
