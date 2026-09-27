"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, Landmark, Target, TriangleAlert, UsersRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Donut } from "@/components/charts/Donut";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { PortfolioEvolution, ScoreBands } from "@/components/dashboard/PortfolioCharts";
import { PriorityTable } from "@/components/dashboard/PriorityTable";
import { WalletShareList } from "@/components/dashboard/WalletShareCard";
import { INSIGHT_SEVERITY, headline, insightHref } from "@/components/insights/InsightCard";
import { IconTile } from "@/components/ui/Avatar";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Segmented } from "@/components/ui/Segmented";
import { KpiCard } from "@/components/ui/StatTile";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { api } from "@/lib/api";
import { brlCompact, monthLong, num } from "@/lib/format";
import { OPPORTUNITY_META, OPPORTUNITY_ORDER } from "@/lib/labels";
import { useRole } from "@/lib/role";

export default function DashboardPage() {
  const role = useRole();
  const router = useRouter();
  const [span, setSpan] = useState<"6" | "12">("6");
  const summary = useQuery({ queryKey: ["portfolio-summary", role], queryFn: api.portfolioSummary });
  const distribution = useQuery({ queryKey: ["distribution", role], queryFn: api.opportunityDistribution });
  const priority = useQuery({ queryKey: ["priority", role], queryFn: () => api.priorityCustomers(5) });
  const activity = useQuery({ queryKey: ["activity", role], queryFn: api.activity });
  const wallet = useQuery({ queryKey: ["wallet-share", role], queryFn: api.walletShare });
  const insights = useQuery({ queryKey: ["insights", role], queryFn: api.insights });

  if (summary.error) return <ErrorState error={summary.error} className="mt-24" />;
  const s = summary.data;
  const byType = Object.fromEntries((distribution.data ?? []).map((d) => [d.type, d]));

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Visão da Carteira"
        description="Panorama geral dos seus clientes e oportunidades de Open Finance"
        actions={
          s && (
            <span className="inline-flex h-11 items-center gap-2.5 rounded-lg border border-line-strong bg-white px-4 text-[13.5px] font-medium text-ink shadow-[0_1px_2px_rgb(16_32_64/0.04)]">
              <CalendarDays className="size-[18px] text-ink-2" />
              Dados até {monthLong(s.reference_month)}
            </span>
          )
        }
      />

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {s ? (
          <>
            <KpiCard
              label="Clientes analisados"
              value={num(s.customers)}
              icon={UsersRound}
              tone="blue"
              delta={{ text: `+${num(s.new_connections_last_month)} novos no mês`, direction: "up", good: true }}
            />
            <KpiCard
              label="Oportunidades ativas"
              value={num(s.open_opportunities)}
              icon={Target}
              tone="green"
              delta={{ text: `${brlCompact(s.opportunity_value)} em valor`, good: true }}
            />
            <KpiCard
              label="Clientes com alertas"
              value={num(s.customers_with_signals)}
              icon={TriangleAlert}
              tone="red"
              delta={{ text: `${num(s.customers_high_severity)} de severidade alta`, good: false }}
            />
            <KpiCard
              label="Instituições conectadas"
              value={num(s.institutions_connected)}
              icon={Landmark}
              tone="blue"
              delta={{ text: `+${num(s.consents_last_month)} consentimentos`, direction: "up", good: true }}
            />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[112px] rounded-xl" />)
        )}
      </div>

      {/* Charts row */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,0.95fr)]">
        <Card>
          <CardHeader title="Distribuição das oportunidades" />
          <div className="px-5 pb-5">
            {distribution.data && s ? (
              <Donut
                size={164}
                thickness={24}
                centerValue={num(distribution.data.reduce((sum, d) => sum + d.count, 0))}
                centerLabel="oportunidades"
                valueFormatter={(v) => `${num(v)} oportunidades`}
                onSelect={(type) => router.push(`/oportunidades?type=${type}`)}
                slices={OPPORTUNITY_ORDER.filter((t) => byType[t]).map((t) => ({
                  key: t,
                  label: OPPORTUNITY_META[t].label,
                  value: byType[t].count,
                  color: OPPORTUNITY_META[t].color,
                }))}
              />
            ) : (
              <Skeleton className="h-[190px]" />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Evolução da carteira"
            subtitle="Adoção do Open Finance no fim de cada mês"
            actions={
              <Segmented
                size="sm"
                value={span}
                onChange={setSpan}
                options={[
                  { value: "6", label: "6M" },
                  { value: "12", label: "12M" },
                ]}
              />
            }
          />
          <div className="px-4 pb-4">
            {s ? <PortfolioEvolution points={s.connections_trend.slice(-Number(span))} /> : <Skeleton className="h-[230px]" />}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Clientes por score de oportunidade"
            subtitle={s ? `${num(s.customers_with_opportunities)} clientes com ao menos uma oportunidade` : undefined}
          />
          <div className="px-3 pb-3">{s ? <ScoreBands bands={s.score_bands} /> : <Skeleton className="mx-2 h-[230px]" />}</div>
        </Card>
      </div>

      {/* Priority customers + activity */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Clientes em destaque"
            subtitle="Score a partir de 80 — passe o mouse no score para ver os motivos"
            actions={
              <Link href="/clientes?min_score=80" className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary-ink hover:underline">
                Ver todos <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          {priority.data ? <PriorityTable rows={priority.data} /> : <Skeleton className="mx-5 mb-5 h-72" />}
        </Card>

        <Card>
          <CardHeader
            title="Movimentações relevantes"
            actions={
              <Link href="/clientes?has_signals=true" className="text-[13px] font-semibold text-primary-ink hover:underline">
                Ver todas
              </Link>
            }
          />
          <div className="pb-2">{activity.data ? <ActivityFeed items={activity.data} /> : <Skeleton className="mx-5 mb-5 h-64" />}</div>
        </Card>
      </div>

      {/* Where the money is + insights */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Onde está o dinheiro da carteira" subtitle="Participação do banco principal e das outras instituições, por produto" />
          <div className="px-5 pb-5">{wallet.data ? <WalletShareList data={wallet.data} /> : <Skeleton className="h-64" />}</div>
        </Card>
        <Card>
          <CardHeader
            title="Insights da carteira"
            subtitle="Gerados a cada execução do motor"
            actions={
              <Link href="/insights" className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary-ink hover:underline">
                Todos os insights <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          <ul className="divide-y divide-line pb-2">
            {insights.data
              ? insights.data.slice(0, 4).map((insight) => {
                  const severity = INSIGHT_SEVERITY[insight.severity];
                  return (
                    <li key={insight.insight_id}>
                      <Link href={insightHref(insight)} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2">
                        <IconTile icon={severity.icon} tone={severity.tone} size="md" className="rounded-xl" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13.5px] font-medium text-ink">{insight.title}</div>
                          <div className="text-[12px] text-ink-3">{insight.affected_customers > 0 ? `${num(insight.affected_customers)} clientes` : "Indicador da carteira"}</div>
                        </div>
                        <span className="tnum shrink-0 text-[15px] font-bold text-[#0a1440]">{headline(insight)}</span>
                      </Link>
                    </li>
                  );
                })
              : Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="mx-5 my-3 h-10" />)}
          </ul>
        </Card>
      </div>
    </div>
  );
}
