// Types mirror the FastAPI response schemas (backend/app/schemas).

export type OpportunityType =
  | "investment"
  | "idle_cash"
  | "debt_optimization"
  | "credit"
  | "relationship"
  | "retention"
  | "spending_migration";

export type OpportunityStatus = "new" | "in_review" | "contacted" | "converted" | "dismissed";
export type Priority = "high" | "medium" | "low";
export type Severity = "high" | "medium" | "low";
export type HealthBand = "excellent" | "healthy" | "attention" | "critical";
export type DebtLevel = "low" | "moderate" | "high";
export type Role = "analista" | "coordenador" | "auditor";

export interface InstitutionRef {
  institution_id: string;
  name: string;
  short_name: string;
  category: string;
  brand_color: string;
  is_primary: boolean;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface Evidence {
  text: string;
  kind: "support" | "context" | "caution";
}

export interface ScoreFactor {
  key: string;
  label: string;
  points: number;
  max_points: number;
  detail: string;
}

export interface MetricValue {
  key: string;
  label: string;
  value: number | string;
  format: "currency" | "percent" | "number" | "text" | "rate";
}

export interface Meta {
  app: { name: string; version: string; environment: string; synthetic_data: boolean };
  primary_institution: InstitutionRef;
  institutions: InstitutionRef[];
  institution_categories: Record<string, string>;
  opportunity_types: { key: OpportunityType; label: string; title: string }[];
  opportunity_statuses: { key: OpportunityStatus; label: string }[];
  signal_types: { key: string; label: string }[];
  health_bands: { key: HealthBand; label: string; min: number }[];
  segments: { segment_id: number; name: string; description: string; size: number }[];
  reference_month: string | null;
  last_run: EngineRunRef | null;
  analyst: { id: string; name: string; role: Role; role_label: string; permissions: string[] };
  roles: { key: Role; label: string; description: string; permissions: string[] }[];
  permission_labels: Record<string, string>;
  ai: AiStatus;
  simulation: SimulationAssumptions;
}

export interface SimulationAssumptions {
  cdi_monthly: number;
  expensive_debt_rate: number;
  reference_rates: { loan_type: string; label: string; rate: number }[];
  investment_products: { type: string; label: string; monthly_yield: number; liquidity: string; risk: string }[];
}

export interface AiStatus {
  enabled: boolean;
  provider: string | null;
  model: string | null;
  mode: "llm" | "template";
  guardrails: string[];
}

export interface EngineRunRef {
  run_id: string;
  finished_at: string | null;
  duration_ms: number | null;
  trigger: string;
  engine_version: string;
}

// ---- Portfolio ------------------------------------------------------------------------

export interface PortfolioSummary {
  customers: number;
  customers_with_opportunities: number;
  customers_connected: number;
  new_connections_last_month: number;
  customers_with_signals: number;
  customers_high_severity: number;
  total_assets: number;
  total_investments: number;
  total_debt: number;
  opportunities: number;
  open_opportunities: number;
  opportunity_value: number;
  priority_customers: number;
  institutions_connected: number;
  avg_health_score: number;
  signals: number;
  active_consents: number;
  consents_last_month: number;
  external_asset_share: number;
  reference_month: string;
  last_run: EngineRunRef | null;
  trend: { month: string; total_assets: number; investments: number; debt: number; card_spend: number }[];
  connections_trend: { month: string; customers_connected: number; consents: number; new_customers: number }[];
  score_bands: { key: string; label: string; min: number; max: number; count: number; share: number }[];
}

export interface ActivityItem {
  kind: "connections" | "opportunities" | "priority" | "alerts" | "consents";
  tone: "green" | "amber" | "blue" | "red" | "violet";
  title: string;
  detail: string;
  timestamp: string;
  href: string;
}

export interface OpportunityTypeSummary {
  type: OpportunityType;
  label: string;
  title: string;
  count: number;
  value: number;
  avg_score: number;
  high_priority: number;
  share: number;
}

export interface PriorityCustomer {
  customer_id: string;
  name: string;
  segment: string;
  health_score: number;
  opportunity_id: string;
  opportunity_score: number;
  opportunity_type: OpportunityType;
  opportunity_label: string;
  estimated_value: number;
  summary: string;
  reasons: Evidence[];
  score_breakdown: ScoreFactor[];
  institutions_count: number;
  institutions: InstitutionRef[];
  opportunity_types: OpportunityType[];
  last_update: string;
}

export interface WalletShare {
  products: {
    product: string;
    label: string;
    primary: number;
    external: number;
    primary_share: number;
    top_external: { institution_id: string; short_name: string; brand_color: string; value: number; share: number }[];
  }[];
  trend: { month: string; balances: number; investments: number; card_spend: number }[];
}

export interface RecentSignal {
  signal_id: string;
  customer_id: string;
  customer_name: string;
  signal_type: string;
  type_label: string;
  severity: Severity;
  title: string;
  description: string;
  detected_at: string;
}

export interface Insight {
  insight_id: string;
  rank: number;
  category: string;
  severity: "opportunity" | "risk" | "attention" | "info";
  title: string;
  description: string;
  headline_value: number;
  headline_format: "number" | "currency" | "percent";
  affected_customers: number;
  filters: Record<string, string | boolean>;
  chart: { type: "area" | "bar" | "line"; data: Record<string, string | number>[] } | null;
  generated_at: string;
}

// ---- Customers ------------------------------------------------------------------------

export type ConsentStatus = "active" | "expiring" | "revoked" | "none";

export interface CustomerListItem {
  customer_id: string;
  name: string;
  segment: string;
  age_range: string;
  occupation_category: string;
  state: string;
  monthly_income: number;
  health_score: number;
  health_band: HealthBand;
  opportunity_score: number;
  top_opportunity_type: OpportunityType | null;
  opportunities_count: number;
  opportunity_value: number;
  opportunity_types: OpportunityType[];
  total_assets: number;
  total_debt: number;
  debt_level: DebtLevel;
  institutions_count: number;
  institutions: string[];
  signals_count: number;
  is_anomaly: boolean;
  segment_id: number | null;
  segment_name: string | null;
  consent_status: ConsentStatus;
}

export interface CustomerTabCounts {
  all: number;
  with_opportunities: number;
  with_signals: number;
  new_connections: number;
}

export interface CustomerSearchHit {
  customer_id: string;
  name: string;
  segment: string;
  opportunity_score: number;
  top_opportunity_type: OpportunityType | null;
}

export interface HealthComponent {
  key: string;
  label: string;
  weight: number;
  metric: string;
  score: number;
  points: number;
  display: string;
  explanation: string;
}

export interface Health {
  score: number;
  band: HealthBand;
  band_label: string;
  components: HealthComponent[];
}

export interface EcosystemNode {
  institution: InstitutionRef;
  products: string[];
  receives_salary: boolean;
  account_balance: number;
  investment_balance: number;
  debt_balance: number;
  card_spend_monthly: number;
  card_limit: number;
  monthly_inflow: number;
  monthly_outflow: number;
  share_of_assets: number;
  consent_status: string | null;
}

export interface CashFlowBreakdown {
  income: number;
  expenses: number;
  debt_payments: number;
  investments: number;
  available: number;
}

export interface TimelinePoint {
  month: string;
  income: number;
  expenses: number;
  debt_payments: number;
  investment_net: number;
  available_cash: number;
  balance_primary: number;
  balance_external: number;
  investments_primary: number;
  investments_external: number;
  debt_total: number;
  net_worth: number;
  card_spend_primary: number;
  card_spend_external: number;
  salary_institution_id: string | null;
}

export interface Signal {
  signal_id: string;
  customer_id: string;
  signal_type: string;
  type_label: string;
  severity: Severity;
  title: string;
  description: string;
  metric_before: number | null;
  metric_after: number | null;
  change_pct: number | null;
  detected_at: string;
  details: Record<string, unknown>;
}

export interface Opportunity {
  opportunity_id: string;
  customer_id: string;
  type: OpportunityType;
  type_label: string;
  title: string;
  score: number;
  priority: Priority;
  estimated_value: number;
  summary: string;
  evidence: Evidence[];
  score_breakdown: ScoreFactor[];
  metrics: MetricValue[];
  context: Record<string, unknown>;
  recommended_action: string;
  rule_id: string;
  engine_version: string;
  status: OpportunityStatus;
  status_label: string;
  created_at: string;
  updated_at: string;
}

export interface ConsentItem {
  consent_id: string;
  institution: InstitutionRef;
  status: "active" | "expiring" | "revoked";
  scopes: string[];
  purpose: string;
  granted_at: string;
  expires_at: string;
  last_sync_at: string | null;
}

export interface RelationshipRow {
  category: string;
  label: string;
  primary_value: number;
  external_value: number;
  primary_share: number | null;
  held_at: { institution_id: string; short_name: string; value: number }[];
}

export interface Customer360 {
  customer: {
    customer_id: string;
    name: string;
    age_range: string;
    occupation_category: string;
    segment: string;
    state: string;
    relationship_since: string;
    tenure_years: number;
    declared_income: number;
    primary_bank: InstitutionRef;
  };
  metrics: {
    monthly_income: number;
    monthly_expenses: number;
    total_balance: number;
    total_investments: number;
    total_assets: number;
    total_debt: number;
    expensive_debt: number;
    net_worth: number;
    institutions_count: number;
    external_asset_share: number;
    card_external_share: number;
    debt_service_ratio: number;
    debt_level: DebtLevel;
    opportunity_score: number;
    opportunities_count: number;
    opportunity_value: number;
    signals_count: number;
  };
  health: Health;
  segment: { segment_id: number; name: string; description: string } | null;
  anomaly: { is_anomaly: boolean; score: number; reasons: string[] };
  consent: { active: number; expiring: number; revoked: number; items: ConsentItem[] };
  ecosystem: EcosystemNode[];
  cash_flow: { month: string; last_month: CashFlowBreakdown; average_6m: CashFlowBreakdown };
  timeline: TimelinePoint[];
  opportunities: Opportunity[];
  signals: Signal[];
  relationship_map: RelationshipRow[];
  asset_breakdown: { key: string; label: string; value: number; share: number }[];
  products: CustomerProducts;
  last_sync_at: string;
  reference_month: string;
}

export interface CustomerProducts {
  accounts: { account_id: string; institution: InstitutionRef; account_type: string; label: string; balance: number; average_balance: number; opened_at: string }[];
  cards: { card_id: string; institution: InstitutionRef; brand: string; tier: string; credit_limit: number; monthly_bill: number; utilization: number }[];
  investments: {
    investment_id: string;
    institution: InstitutionRef;
    investment_type: string;
    label: string;
    product_name: string;
    balance: number;
    risk_category: string;
    liquidity: string;
  }[];
  loans: {
    loan_id: string;
    institution: InstitutionRef;
    loan_type: string;
    label: string;
    balance: number;
    interest_rate: number;
    installment: number;
    remaining_months: number | null;
    reference_rate: number | null;
    expensive: boolean;
  }[];
}

export interface InstitutionDrilldown {
  institution: InstitutionRef;
  relationship: EcosystemNode;
  accounts: { account_id: string; account_type: string; label: string; balance: number; average_balance: number; opened_at: string }[];
  cards: { card_id: string; brand: string; tier: string; credit_limit: number; monthly_bill: number; utilization: number }[];
  investments: {
    investment_id: string;
    investment_type: string;
    label: string;
    product_name: string;
    balance: number;
    risk_category: string;
    liquidity: string;
  }[];
  loans: {
    loan_id: string;
    loan_type: string;
    label: string;
    balance: number;
    interest_rate: number;
    installment: number;
    remaining_months: number | null;
    expensive: boolean;
  }[];
  transactions: {
    transaction_id: number;
    date: string;
    description: string;
    category: string;
    category_label: string;
    transaction_type: "credito" | "debito" | "cartao";
    amount: number;
  }[];
  spending_by_category: { category: string; label: string; value: number; share: number }[];
  monthly: { month: string; inflow: number; outflow: number }[];
  avg_monthly_spend: number;
  consent: ConsentItem | null;
}

export interface AiSummary {
  summary: string;
  source: "llm" | "template";
  model: string | null;
  generated_at: string;
  facts_used: string[];
  disclaimer: string;
  notice: string | null;
}

export interface AskResponse {
  question: string;
  answer: string;
  source: "llm" | "template";
  model: string | null;
  facts_used: string[];
  notice: string | null;
}

// ---- Opportunities ----------------------------------------------------------------------

export interface OpportunityListItem {
  opportunity_id: string;
  customer_id: string;
  customer_name: string;
  segment: string;
  institutions_count: number;
  type: OpportunityType;
  type_label: string;
  title: string;
  score: number;
  priority: Priority;
  estimated_value: number;
  summary: string;
  top_evidence: string[];
  status: OpportunityStatus;
  status_label: string;
  created_at: string;
}

export interface OpportunitiesSummary {
  total: number;
  total_value: number;
  high_priority: number;
  by_type: OpportunityTypeSummary[];
  by_status: Record<OpportunityStatus, number>;
}

export interface OpportunityDetail extends Opportunity {
  customer: {
    customer_id: string;
    name: string;
    segment: string;
    age_range: string;
    occupation_category: string;
    monthly_income: number;
    total_assets: number;
    total_debt: number;
    health_score: number;
    health_band: HealthBand;
    institutions_count: number;
    tenure_years: number;
  };
  series: TimelinePoint[];
  related: { opportunity_id: string; type: OpportunityType; type_label: string; score: number; estimated_value: number; status: OpportunityStatus }[];
  history: {
    timestamp: string;
    kind: "detected" | "status_change";
    actor: string;
    role: string | null;
    from_status: OpportunityStatus | null;
    to_status: OpportunityStatus | null;
    note: string | null;
  }[];
  explanation: string;
  guardrail: string;
}

export interface ReportInfo {
  key: string;
  title: string;
  description: string;
  format: "csv";
  permission: string;
  permission_label: string;
  available: boolean;
  rows: number;
  last_export: string | null;
}

// ---- Institutions / analytics / governance -----------------------------------------------

export type ProductKey = "salario" | "conta" | "cartao" | "investimentos" | "emprestimo";

export interface InstitutionRow {
  institution: InstitutionRef;
  category_label: string;
  customers: number;
  customer_share: number;
  salary_customers: number;
  account_balance: number;
  investment_balance: number;
  debt_balance: number;
  card_spend_monthly: number;
  total_assets: number;
  share_of_assets: number;
  share_of_card_spend: number;
  products: Record<ProductKey, number>;
}

export interface InstitutionDetail {
  institution: InstitutionRef;
  category_label: string;
  customers: number;
  salary_customers: number;
  account_balance: number;
  investment_balance: number;
  debt_balance: number;
  card_spend_monthly: number;
  products: Record<ProductKey, number>;
  monthly: { month: string; account_balance: number; investment_balance: number; loan_balance: number; card_bill: number; customers: number }[];
  top_customers: {
    customer_id: string;
    name: string;
    products: ProductKey[];
    account_balance: number;
    investment_balance: number;
    debt_balance: number;
    card_spend_monthly: number;
    opportunity_score: number;
    top_opportunity_type: OpportunityType | null;
  }[];
  primary_overlap: { customers: number; investments: number; card_spend_monthly: number } | null;
}

export interface AnalyticsOverview {
  segments: {
    segment_id: number;
    name: string;
    description: string;
    size: number;
    profile: {
      avg_income: number;
      avg_assets: number;
      median_assets: number;
      external_asset_share: number;
      card_external_share: number;
      debt_service_ratio: number;
      liquidity_months: number;
      institutions: number;
      health_score: number;
    };
    opportunities: { type: OpportunityType; label: string; count: number }[];
  }[];
  model: {
    algorithm: string;
    k: number;
    features: string[];
    silhouette: number | null;
    anomaly_algorithm: string;
    anomalies: number;
    timings: Record<string, number> | null;
  };
  health_histogram: { bin: string; from: number; count: number }[];
  score_histogram: { bin: string; from: number; count: number }[];
  band_counts: Record<HealthBand, number>;
  scatter: {
    customer_id: string;
    name: string;
    segment_id: number;
    income: number;
    external_asset_share: number;
    card_external_share: number;
    assets: number;
    health_score: number;
    debt_service_ratio: number;
  }[];
  trend: {
    month: string;
    balances_primary_share: number;
    investments_primary_share: number;
    card_primary_share: number;
    income: number;
    expenses: number;
  }[];
  anomalies: { customer_id: string; name: string; score: number; reasons: string[]; health_score: number }[];
}

export interface EngineRun {
  run_id: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  status: string;
  trigger: string;
  engine_version: string;
  customers_processed: number;
  opportunities_created: number;
  signals_created: number;
  stats: {
    stages?: Record<string, number>;
    timings?: Record<string, number>;
    silhouette?: number;
    priority_customers?: number;
    opportunities_by_type?: Record<string, number>;
    reference_date?: string;
  };
}

export interface EngineConfig {
  version: string;
  min_score: number;
  priority_thresholds: { high: number; medium: number };
  rules: {
    rule_id: string;
    type: OpportunityType;
    name: string;
    label: string;
    description: string;
    params: Record<string, number>;
    version: string;
  }[];
  health_components: { key: string; label: string; weight: number; metric: string }[];
  signal_thresholds: Record<string, number>;
  signal_types: Record<string, string>;
  runs: EngineRun[];
  ai: AiStatus;
}

export interface ConsentOverview {
  total: number;
  active: number;
  expiring: number;
  revoked: number;
  by_institution: { institution_id: string; short_name: string; brand_color: string; active: number; expiring: number; revoked: number }[];
  scopes: Record<string, number>;
  purpose: string;
}

export interface AuditLogEntry {
  id: number;
  timestamp: string;
  actor: string;
  role: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  purpose: string;
  details: Record<string, unknown> | null;
}
