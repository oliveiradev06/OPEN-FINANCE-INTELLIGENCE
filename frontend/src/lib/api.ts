import { getRole } from "./role";
import type {
  AiSummary,
  AnalyticsOverview,
  AskResponse,
  AuditLogEntry,
  ConsentOverview,
  Customer360,
  CustomerListItem,
  CustomerSearchHit,
  EngineConfig,
  EngineRun,
  Insight,
  InstitutionDetail,
  InstitutionDrilldown,
  InstitutionRow,
  Meta,
  OpportunitiesSummary,
  OpportunityDetail,
  OpportunityListItem,
  OpportunityStatus,
  OpportunityTypeSummary,
  Page,
  PortfolioSummary,
  PriorityCustomer,
  RecentSignal,
  Role,
  WalletShare,
} from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Params = Record<string, string | number | boolean | string[] | null | undefined>;

export function toQuery(params: Params): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) value.forEach((v) => search.append(key, v));
    else search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", "X-Analyst-Role": getRole(), ...init?.headers },
    cache: "no-store",
  });
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(response.status, detail);
  }
  return response.json() as Promise<T>;
}

export const api = {
  meta: () => request<Meta>("/meta"),

  portfolioSummary: () => request<PortfolioSummary>("/portfolio/summary"),
  opportunityDistribution: () => request<OpportunityTypeSummary[]>("/portfolio/opportunity-distribution"),
  priorityCustomers: (limit = 10, type?: string) =>
    request<PriorityCustomer[]>(`/portfolio/priority-customers${toQuery({ limit, type })}`),
  walletShare: () => request<WalletShare>("/portfolio/wallet-share"),
  recentSignals: (limit = 8) => request<RecentSignal[]>(`/portfolio/recent-signals?limit=${limit}`),

  customers: (params: Params) => request<Page<CustomerListItem>>(`/customers${toQuery(params)}`),
  searchCustomers: (q: string) => request<CustomerSearchHit[]>(`/customers/search${toQuery({ q })}`),
  customer: (id: string) => request<Customer360>(`/customers/${id}`),
  customerInstitution: (id: string, institutionId: string) =>
    request<InstitutionDrilldown>(`/customers/${id}/institutions/${institutionId}`),
  customerSummary: (id: string) => request<AiSummary>(`/customers/${id}/summary`),
  ask: (id: string, question: string) =>
    request<AskResponse>(`/customers/${id}/ask`, { method: "POST", body: JSON.stringify({ question }) }),

  opportunities: (params: Params) => request<Page<OpportunityListItem>>(`/opportunities${toQuery(params)}`),
  opportunitiesSummary: () => request<OpportunitiesSummary>("/opportunities/summary"),
  opportunity: (id: string) => request<OpportunityDetail>(`/opportunities/${id}`),
  updateOpportunity: (id: string, status: OpportunityStatus, note?: string) =>
    request<OpportunityDetail>(`/opportunities/${id}`, { method: "PATCH", body: JSON.stringify({ status, note }) }),

  insights: () => request<Insight[]>("/insights"),
  institutions: () => request<{ items: InstitutionRow[]; total_assets: number; total_card_spend: number }>("/institutions"),
  institution: (id: string) => request<InstitutionDetail>(`/institutions/${id}`),
  analytics: () => request<AnalyticsOverview>("/analytics/overview"),

  engineConfig: () => request<EngineConfig>("/governance/engine"),
  consents: () => request<ConsentOverview>("/governance/consents"),
  access: () =>
    request<{
      current: { id: string; name: string; role: Role; role_label: string; permissions: string[] };
      roles: { key: Role; label: string; description: string; permissions: string[] }[];
      permissions: Record<string, string>;
    }>("/governance/access"),
  auditLogs: (limit = 60) => request<{ items: AuditLogEntry[]; counts: Record<string, number> }>(`/governance/audit-logs?limit=${limit}`),
  runEngine: () => request<EngineRun>("/engine/run", { method: "POST" }),
};
