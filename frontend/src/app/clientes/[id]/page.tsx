"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowLeft, HeartPulse, Network, Sparkles, Target, TrendingUp, Wallet } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useState } from "react";
import { AiPanel } from "@/components/customer/AiPanel";
import { CashFlowTrend, CashFlowWaterfall } from "@/components/customer/CashFlow";
import { CustomerHeader } from "@/components/customer/CustomerHeader";
import { EcosystemGraph } from "@/components/customer/EcosystemGraph";
import { HealthBreakdown } from "@/components/customer/HealthBreakdown";
import { InstitutionDrawer } from "@/components/customer/InstitutionDrawer";
import { OpportunityCard } from "@/components/customer/OpportunityCard";
import { RelationshipMap, ResourceDistribution } from "@/components/customer/Relationship";
import { SignalsList } from "@/components/customer/SignalsList";
import { TimelineMultiples } from "@/components/customer/TimelineMultiples";
import { Card, CardHeader, SectionTitle } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { api } from "@/lib/api";
import { brl, monthLabel, pct } from "@/lib/format";
import { useInstitutions } from "@/lib/hooks";
import { useRole } from "@/lib/role";

function change(values: number[]): number | undefined {
  const first = values[0];
  const last = values[values.length - 1];
  return first ? last / first - 1 : undefined;
}

export default function Customer360Page() {
  const { id } = useParams<{ id: string }>();
  const role = useRole();
  const institutions = useInstitutions();
  const [openInstitution, setOpenInstitution] = useState<string | null>(null);
  const onOpen = useCallback((institutionId: string) => setOpenInstitution(institutionId), []);
  const { data, error } = useQuery({ queryKey: ["customer", id, role], queryFn: () => api.customer(id) });

  if (error) return <ErrorState error={error} className="mt-24" />;
  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-36 rounded-xl" />
        <div className="grid grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[520px] rounded-xl" />
      </div>
    );
  }

  const { metrics, timeline } = data;
  const since = timeline[0] ? `vs. ${monthLabel(timeline[0].month)}` : undefined;
  const assets = timeline.map((t) => t.balance_primary + t.balance_external + t.investments_primary + t.investments_external);

  return (
    <div className="animate-fade-in">
      <Link href="/clientes" className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-ink-3 hover:text-ink">
        <ArrowLeft className="size-3.5" /> Clientes
      </Link>

      <CustomerHeader data={data} />

      {/* Financial overview KPIs */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Renda mensal" value={brl(metrics.monthly_income)} delta={change(timeline.map((t) => t.income))} deltaLabel={since} trend={timeline.map((t) => t.income)} />
        <StatTile label="Patrimônio" value={brl(metrics.total_assets)} delta={change(assets)} deltaLabel={since} trend={assets} />
        <StatTile
          label="Dívidas"
          value={brl(metrics.total_debt)}
          delta={change(timeline.map((t) => t.debt_total))}
          deltaLabel={since}
          upIsGood={false}
          trend={timeline.map((t) => t.debt_total)}
        />
        <StatTile
          label="Gasto mensal"
          value={brl(metrics.monthly_expenses)}
          delta={change(timeline.map((t) => t.expenses))}
          deltaLabel={since}
          upIsGood={false}
          trend={timeline.map((t) => t.expenses)}
        />
        <StatTile
          label="Instituições conectadas"
          value={metrics.institutions_count}
          hint={`${pct(metrics.external_asset_share)} do patrimônio fora do banco`}
        />
      </div>

      {/* Financial ecosystem */}
      <div className="mt-8">
        <SectionTitle hint="Clique em uma instituição para ver saldo, produtos e transações">Financial Ecosystem</SectionTitle>
        <div className="grid gap-4 xl:grid-cols-12">
          <Card className="flex flex-col overflow-hidden xl:col-span-8">
            <CardHeader
              icon={<Network className="size-4" />}
              title="Relacionamento com instituições"
              subtitle="Espessura da conexão ∝ volume financeiro · linha animada = crédito de salário"
            />
            <div className="flex-1">
              <EcosystemGraph data={data} onOpen={onOpen} />
            </div>
          </Card>
          <div className="grid gap-4 xl:col-span-4">
            <Card>
              <CardHeader icon={<Wallet className="size-4" />} title="Onde está o dinheiro" subtitle="Saldo + investimentos por instituição" />
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
      </div>

      {/* Cash flow */}
      <div className="mt-8">
        <SectionTitle>Financial Overview</SectionTitle>
        <div className="grid gap-4 xl:grid-cols-12">
          <Card className="xl:col-span-5">
            <CardHeader title="Fluxo de caixa" subtitle="Para onde vai cada real da renda" />
            <div className="px-5 pb-5">
              <CashFlowWaterfall lastMonth={data.cash_flow.last_month} average={data.cash_flow.average_6m} />
            </div>
          </Card>
          <Card className="xl:col-span-7">
            <CardHeader title="Renda e gastos mês a mês" subtitle="Últimos 12 meses" />
            <div className="px-3 pb-4">
              <CashFlowTrend timeline={timeline} />
            </div>
          </Card>
        </div>
      </div>

      {/* Opportunities */}
      <div className="mt-8">
        <SectionTitle hint={`${data.opportunities.length} detectada${data.opportunities.length === 1 ? "" : "s"} pelo motor`}>Opportunities</SectionTitle>
        {data.opportunities.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.opportunities.map((o) => (
              <OpportunityCard key={o.opportunity_id} opportunity={o} />
            ))}
          </div>
        ) : (
          <Card className="flex items-center gap-2 px-5 py-6 text-[13px] text-ink-2">
            <Target className="size-4 text-ink-3" /> Nenhuma oportunidade acima do score mínimo para este cliente.
          </Card>
        )}
      </div>

      {/* Health + behaviour */}
      <div className="mt-8 grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <CardHeader
            icon={<HeartPulse className="size-4" />}
            title={`Financial Health · ${data.health.score}/100`}
            subtitle="Seis componentes ponderados — cada ponto é rastreável até um número"
          />
          <div className="px-5 pb-5">
            <HealthBreakdown health={data.health} />
          </div>
        </Card>
        <Card className="xl:col-span-7">
          <CardHeader
            icon={<Activity className="size-4" />}
            title="Mudanças de comportamento"
            subtitle="Último trimestre comparado ao trimestre anterior"
          />
          <div className="px-5 pb-5">
            <SignalsList signals={data.signals} />
            {data.anomaly.is_anomaly && (
              <div className="mt-3 rounded-lg border border-violet/25 bg-violet/[0.06] p-3.5 text-[12.5px] text-ink-2">
                <span className="font-medium text-ink">Comportamento atípico (Isolation Forest):</span> {data.anomaly.reasons.join(" · ")}.
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Timeline */}
      <div className="mt-8">
        <SectionTitle hint="Cada medida na sua própria escala">
          <span className="inline-flex items-center gap-1.5">
            <TrendingUp className="size-3.5" /> Timeline financeira
          </span>
        </SectionTitle>
        <TimelineMultiples timeline={timeline} />
      </div>

      {/* AI */}
      <div className="mt-8">
        <SectionTitle>
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="size-3.5" /> AI Insights
          </span>
        </SectionTitle>
        <AiPanel data={data} />
      </div>

      <InstitutionDrawer customerId={id} institutionId={openInstitution} onClose={() => setOpenInstitution(null)} />
    </div>
  );
}
