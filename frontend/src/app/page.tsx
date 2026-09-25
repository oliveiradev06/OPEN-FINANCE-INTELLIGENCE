"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowRight, Landmark, Radar, Target, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AreaTrend } from "@/components/charts/AreaTrend";
import { BarList } from "@/components/charts/BarList";
import { PriorityTable } from "@/components/dashboard/PriorityTable";
import { SignalsFeed } from "@/components/dashboard/SignalsFeed";
import { WalletShareList } from "@/components/dashboard/WalletShareCard";
import { InsightCard } from "@/components/insights/InsightCard";
import { Card, CardHeader } from "@/components/ui/Card";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { OpportunityIcon } from "@/components/ui/OpportunityTag";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { api } from "@/lib/api";
import { brl, brlCompact, monthLabel, monthLong, num, pct } from "@/lib/format";
import { OPPORTUNITY_META, OPPORTUNITY_ORDER } from "@/lib/labels";
import { useRole } from "@/lib/role";

export default function DashboardPage() {
  const role = useRole();
  const router = useRouter();
  const [priorityType, setPriorityType] = useState("");
  const summary = useQuery({ queryKey: ["portfolio-summary", role], queryFn: api.portfolioSummary });
  const distribution = useQuery({ queryKey: ["distribution", role], queryFn: api.opportunityDistribution });
  const priority = useQuery({
    queryKey: ["priority", role, priorityType],
    queryFn: () => api.priorityCustomers(10, priorityType || undefined),
  });
  const wallet = useQuery({ queryKey: ["wallet-share", role], queryFn: api.walletShare });
  const signals = useQuery({ queryKey: ["recent-signals", role], queryFn: () => api.recentSignals(6) });
  const insights = useQuery({ queryKey: ["insights", role], queryFn: api.insights });

  if (summary.error) return <ErrorState error={summary.error} className="mt-24" />;
  const s = summary.data;
  const trend = s?.trend ?? [];
  const assetsDelta = trend.length > 1 ? trend[trend.length - 1].total_assets / trend[0].total_assets - 1 : undefined;

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Portfolio Intelligence"
        title="Visão da carteira"
        description={
          s
            ? `${num(s.customers)} clientes com dados Open Finance consolidados de ${s.institutions_connected} instituições · dados até ${monthLong(s.reference_month)}.`
            : "Consolidando dados Open Finance da carteira…"
        }
        actions={
          <Link
            href="/oportunidades"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-4 text-[13px] font-semibold text-[#04110c] transition-colors hover:bg-accent-soft"
          >
            <Target className="size-4" /> Trabalhar oportunidades
          </Link>
        }
      />

      {/* Hero + KPI row */}
      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="relative overflow-hidden p-5 lg:col-span-5">
          <div className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-accent/10 blur-3xl" />
          <div className="text-[12.5px] font-medium text-ink-2">Patrimônio analisado</div>
          {s ? (
            <>
              <div className="mt-2 text-[48px] leading-none font-semibold tracking-tight text-ink">{brlCompact(s.total_assets)}</div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink-3">
                <span>
                  <span className="font-semibold text-ink">{pct(s.external_asset_share)}</span> fora do banco principal
                </span>
                <span>
                  <span className="font-semibold text-ink">{brlCompact(s.total_investments)}</span> em investimentos
                </span>
                {assetsDelta !== undefined && (
                  <span>
                    <span className="font-semibold text-ink">{assetsDelta >= 0 ? "+" : ""}{pct(assetsDelta, 1)}</span> em 12 meses
                  </span>
                )}
              </div>
              <div className="-mx-2 mt-3">
                <AreaTrend
                  id="hero-assets"
                  name="Patrimônio da carteira"
                  data={trend.map((t) => ({ label: monthLabel(t.month), value: t.total_assets }))}
                  height={120}
                  axes={false}
                  color="var(--color-accent)"
                />
              </div>
            </>
          ) : (
            <Skeleton className="mt-3 h-40" />
          )}
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-7">
          {s ? (
            <>
              <StatTile
                label="Clientes analisados"
                value={num(s.customers)}
                icon={<Users className="size-4" />}
                hint={`${num(s.active_consents)} consentimentos ativos`}
              />
              <StatTile
                label="Oportunidades detectadas"
                value={num(s.opportunities)}
                icon={<Target className="size-4" />}
                hint={`${brlCompact(s.opportunity_value)} em valor identificado`}
              />
              <StatTile
                label="Clientes prioritários"
                value={num(s.priority_customers)}
                icon={<Radar className="size-4" />}
                hint="Opportunity Score ≥ 80"
                emphasis
              />
              <StatTile
                label="Instituições conectadas"
                value={num(s.institutions_connected)}
                icon={<Landmark className="size-4" />}
                hint={`${num(s.signals)} mudanças de comportamento`}
              />
            </>
          ) : (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[120px] rounded-xl" />)
          )}
        </div>
      </div>

      {/* Distribution + wallet share */}
      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardHeader
            title="Distribuição de oportunidades"
            subtitle="Quantidade por tipo · clique para abrir a lista"
          />
          <div className="px-5 pb-5">
            {distribution.data ? (
              <BarList
                onSelect={(type) => router.push(`/oportunidades?type=${type}`)}
                items={distribution.data.map((d) => ({
                  key: d.type,
                  label: (
                    <span className="inline-flex items-center gap-2">
                      <OpportunityIcon type={d.type} className="size-3.5" />
                      {OPPORTUNITY_META[d.type].label}
                    </span>
                  ),
                  value: d.count,
                  display: (
                    <>
                      {num(d.count)} <span className="font-normal text-ink-3">· {pct(d.share)}</span>
                    </>
                  ),
                  secondary: brlCompact(d.value),
                }))}
              />
            ) : (
              <Skeleton className="h-64" />
            )}
          </div>
        </Card>

        <Card className="lg:col-span-7">
          <CardHeader
            title="Onde está o dinheiro da carteira"
            subtitle="Participação do banco principal vs. outras instituições, por produto"
          />
          <div className="px-5 pb-5">{wallet.data ? <WalletShareList data={wallet.data} /> : <Skeleton className="h-64" />}</div>
        </Card>
      </div>

      {/* Priority customers + behavioral changes */}
      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader
            title="Clientes prioritários"
            subtitle={
              priorityType
                ? "Score ≥ 80 desta categoria, pelo valor da oportunidade — passe o mouse no score para ver os motivos"
                : "Score ≥ 80, seleção das maiores oportunidades de cada tipo — passe o mouse no score para ver os motivos"
            }
            actions={
              <>
                <FilterSelect
                  label="Todos os tipos"
                  value={priorityType}
                  onChange={setPriorityType}
                  options={OPPORTUNITY_ORDER.map((t) => ({ value: t, label: OPPORTUNITY_META[t].label }))}
                  className="w-[180px]"
                />
                <Link
                  href={`/clientes?min_score=80${priorityType ? `&opportunity_type=${priorityType}` : ""}`}
                  className="hidden items-center gap-1 text-[12.5px] font-medium whitespace-nowrap text-accent-soft hover:text-accent sm:inline-flex"
                >
                  Ver todos <ArrowRight className="size-3.5" />
                </Link>
              </>
            }
          />
          {priority.data ? <PriorityTable rows={priority.data} /> : <Skeleton className="mx-5 mb-5 h-72" />}
        </Card>

        <Card className="xl:col-span-4">
          <CardHeader
            title="Mudanças relevantes"
            subtitle="Último trimestre vs. trimestre anterior"
            icon={<Activity className="size-4" />}
          />
          {signals.data ? <SignalsFeed signals={signals.data} /> : <Skeleton className="mx-5 mb-5 h-72" />}
        </Card>
      </div>

      {/* Insights preview */}
      <div className="mt-8 mb-3 flex items-end justify-between">
        <div>
          <h2 className="text-[16px] font-semibold tracking-tight text-ink">Insights automáticos</h2>
          <p className="text-[12.5px] text-ink-3">Gerados pelo motor a cada execução, com a lista exata de clientes por trás de cada número.</p>
        </div>
        <Link href="/insights" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-accent-soft hover:text-accent">
          Todos os insights <ArrowRight className="size-3.5" />
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {insights.data
          ? insights.data.slice(0, 3).map((insight) => <InsightCard key={insight.insight_id} insight={insight} compact />)
          : Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
      </div>
      {s && (
        <p className="mt-6 text-[12px] text-ink-3">
          Valor total identificado em oportunidades: {brl(s.opportunity_value)} · saúde financeira média da carteira {num(s.avg_health_score, 1)}/100.
        </p>
      )}
    </div>
  );
}
