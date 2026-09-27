"use client";

import { useQuery } from "@tanstack/react-query";
import { Target } from "lucide-react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import { AiPanel } from "@/components/customer/AiPanel";
import { CustomerHeader } from "@/components/customer/CustomerHeader";
import { EcosystemGraph } from "@/components/customer/EcosystemGraph";
import { HealthBreakdown } from "@/components/customer/HealthBreakdown";
import { InstitutionDrawer } from "@/components/customer/InstitutionDrawer";
import { OpportunityCard } from "@/components/customer/OpportunityCard";
import { AssetDonut, EcosystemTiles, InfoGrid, OpportunityRows, RelationshipEvolution, ScoreProfileCard } from "@/components/customer/Overview";
import { AccountsTab, CreditTab, InvestmentsTab, PensionTab } from "@/components/customer/ProductTabs";
import { RelationshipMap, ResourceDistribution } from "@/components/customer/Relationship";
import { SignalsList } from "@/components/customer/SignalsList";
import { TimelineMultiples } from "@/components/customer/TimelineMultiples";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { InstitutionAvatar } from "@/components/ui/InstitutionAvatar";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { Tabs } from "@/components/ui/Tabs";
import { api } from "@/lib/api";
import { dateBR, relativeTime } from "@/lib/format";
import { BAND_META, CONSENT_META, SCOPE_LABELS } from "@/lib/labels";
import { useInstitutions } from "@/lib/hooks";
import { useRole } from "@/lib/role";
import type { Customer360 } from "@/lib/types";

const TABS = ["visao-geral", "conta", "investimentos", "credito", "previdencia", "oportunidades", "open-finance", "historico"] as const;
type Tab = (typeof TABS)[number];

export default function Customer360Page() {
  return (
    <Suspense fallback={<Skeleton className="h-[80vh] rounded-xl" />}>
      <Customer360View />
    </Suspense>
  );
}

function Customer360View() {
  const { id } = useParams<{ id: string }>();
  const role = useRole();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [openInstitution, setOpenInstitution] = useState<string | null>(null);
  const onOpen = useCallback((institutionId: string) => setOpenInstitution(institutionId), []);
  const { data, error } = useQuery({ queryKey: ["customer", id, role], queryFn: () => api.customer(id) });

  const requested = params.get("tab") as Tab | null;
  const tab: Tab = requested && TABS.includes(requested) ? requested : "visao-geral";
  const setTab = (next: string) => router.replace(next === "visao-geral" ? pathname : `${pathname}?tab=${next}`, { scroll: false });

  if (error) return <ErrorState error={error} className="mt-24" />;
  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-xl" />
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <CustomerHeader data={data} onTab={setTab} />
      <Tabs
        className="mb-5"
        value={tab}
        onChange={setTab}
        items={[
          { value: "visao-geral", label: "Visão geral" },
          { value: "conta", label: "Conta e pagamentos" },
          { value: "investimentos", label: "Investimentos" },
          { value: "credito", label: "Crédito" },
          { value: "previdencia", label: "Previdência" },
          { value: "oportunidades", label: "Oportunidades", count: data.opportunities.length },
          { value: "open-finance", label: "Open Finance" },
          { value: "historico", label: "Histórico" },
        ]}
      />

      {tab === "visao-geral" && <OverviewTab data={data} onOpen={onOpen} setTab={setTab} />}
      {tab === "conta" && <AccountsTab data={data} onOpen={onOpen} />}
      {tab === "investimentos" && <InvestmentsTab data={data} onOpen={onOpen} />}
      {tab === "credito" && <CreditTab data={data} onOpen={onOpen} />}
      {tab === "previdencia" && <PensionTab data={data} onOpen={onOpen} />}
      {tab === "oportunidades" && <OpportunitiesTab data={data} />}
      {tab === "open-finance" && <OpenFinanceTab data={data} onOpen={onOpen} />}
      {tab === "historico" && <HistoryTab data={data} />}

      <InstitutionDrawer customerId={id} institutionId={openInstitution} onClose={() => setOpenInstitution(null)} />
    </div>
  );
}

function OverviewTab({ data, onOpen, setTab }: { data: Customer360; onOpen: (id: string) => void; setTab: (tab: string) => void }) {
  const band = BAND_META[data.health.band];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,3.2fr)_minmax(0,5fr)_minmax(0,4.3fr)]">
        <ScoreProfileCard data={data} />
        <InfoGrid data={data} />
        <RelationshipEvolution timeline={data.timeline} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,7.4fr)_minmax(0,5fr)]">
        <EcosystemTiles nodes={data.ecosystem} onOpen={onOpen} onShowMap={() => setTab("open-finance")} />
        <AssetDonut data={data} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,7.4fr)_minmax(0,5fr)]">
        <OpportunityRows opportunities={data.opportunities} onShowAll={() => setTab("oportunidades")} />
        <Card>
          <CardHeader
            title="Saúde financeira"
            subtitle="Seis componentes ponderados; cada ponto vem de um número do cliente"
            actions={<Badge tone={band.tone}>{`${data.health.score}/100 · ${band.label}`}</Badge>}
          />
          <div className="px-5 pb-5">
            <HealthBreakdown health={data.health} />
          </div>
        </Card>
      </div>
      <AiPanel data={data} />
    </div>
  );
}

function OpportunitiesTab({ data }: { data: Customer360 }) {
  if (data.opportunities.length === 0) {
    return (
      <Card>
        <EmptyState icon={Target} title="Nenhuma oportunidade" description="Nenhuma regra do motor alcançou o score mínimo de 45 para este cliente." />
      </Card>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {data.opportunities.map((o) => (
        <OpportunityCard key={o.opportunity_id} opportunity={o} />
      ))}
    </div>
  );
}

function OpenFinanceTab({ data, onOpen }: { data: Customer360; onOpen: (id: string) => void }) {
  const institutions = useInstitutions();
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <Card className="flex flex-col overflow-hidden">
          <CardHeader
            title="Mapa do ecossistema financeiro"
            subtitle="Espessura da ligação proporcional ao volume · linha animada = crédito de salário · clique para detalhar"
          />
          <div className="flex-1 border-t border-line bg-[#fafcfe]">
            <EcosystemGraph data={data} onOpen={onOpen} />
          </div>
        </Card>
        <div className="grid gap-4">
          <Card>
            <CardHeader title="Onde está o dinheiro" subtitle="Saldo e investimentos por instituição" />
            <div className="px-5 pb-5">
              <ResourceDistribution nodes={data.ecosystem} onOpen={onOpen} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Mapa de relacionamento" subtitle="Participação do banco principal por produto" />
            <div className="px-5 pb-5">
              <RelationshipMap rows={data.relationship_map} institutions={institutions} />
            </div>
          </Card>
        </div>
      </div>
      <Card>
        <CardHeader
          title="Consentimentos Open Finance"
          subtitle={`${data.consent.active} ativos · ${data.consent.expiring} expirando · ${data.consent.revoked} revogados · sincronizado ${relativeTime(data.last_sync_at)}`}
        />
        <div className="overflow-x-auto px-5 pb-4">
          <table className="w-full min-w-[820px] text-left text-[13.5px]">
            <thead>
              <tr className="bg-surface-2 text-[12.5px] text-ink-2">
                <th className="rounded-l-lg px-4 py-2.5 font-medium">Instituição</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Escopos</th>
                <th className="px-3 py-2.5 font-medium">Concedido em</th>
                <th className="rounded-r-lg px-4 py-2.5 font-medium">Expira em</th>
              </tr>
            </thead>
            <tbody>
              {data.consent.items.map((c) => (
                <tr key={c.consent_id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => onOpen(c.institution.institution_id)} className="flex items-center gap-2.5 font-semibold text-ink hover:text-primary-ink">
                      <InstitutionAvatar institution={c.institution} size="md" /> {c.institution.name}
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={CONSENT_META[c.status]?.tone ?? "gray"}>{CONSENT_META[c.status]?.label ?? c.status}</Badge>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.scopes.map((s) => (
                        <Badge key={s} tone="gray" size="sm">
                          {SCOPE_LABELS[s] ?? s}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="tnum px-3 py-3 text-ink-2">{dateBR(c.granted_at)}</td>
                  <td className="tnum px-4 py-3 text-ink-2">{dateBR(c.expires_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[12.5px] text-ink-3">Finalidade de todos os consentimentos: {data.consent.items[0]?.purpose ?? "—"}.</p>
        </div>
      </Card>
    </div>
  );
}

function HistoryTab({ data }: { data: Customer360 }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="mb-3 text-[16px] font-semibold tracking-tight text-[#0e1a3a]">Timeline financeira · 12 meses</h2>
        <TimelineMultiples timeline={data.timeline} />
      </div>
      <Card>
        <CardHeader title="Mudanças de comportamento" subtitle="Último trimestre comparado ao trimestre anterior" />
        <div className="px-5 pb-5">
          <SignalsList signals={data.signals} />
          {data.anomaly.is_anomaly && (
            <div className="mt-3 rounded-lg border border-ai/20 bg-ai-soft/60 p-3.5 text-[13px] text-ink-2">
              <span className="font-semibold text-ink">Comportamento atípico (Isolation Forest):</span> {data.anomaly.reasons.join(" · ")}.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
