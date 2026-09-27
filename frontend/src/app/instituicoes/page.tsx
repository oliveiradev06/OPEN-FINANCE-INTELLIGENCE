"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, Download } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarList } from "@/components/charts/BarList";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Drawer } from "@/components/ui/Drawer";
import { InstitutionAvatar } from "@/components/ui/InstitutionAvatar";
import { OpportunityPill } from "@/components/ui/OpportunityTag";
import { PageHeader } from "@/components/ui/PageHeader";
import { Segmented } from "@/components/ui/Segmented";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { api } from "@/lib/api";
import { brl, brlCompact, monthLabel, num, pct } from "@/lib/format";
import { PRODUCT_META } from "@/lib/labels";
import { useRole } from "@/lib/role";
import type { InstitutionRow, ProductKey } from "@/lib/types";

const METRICS = {
  total_assets: { label: "Patrimônio (saldo + investimentos)", get: (r: InstitutionRow) => r.total_assets },
  investment_balance: { label: "Investimentos", get: (r: InstitutionRow) => r.investment_balance },
  card_spend_monthly: { label: "Gasto com cartão (mês)", get: (r: InstitutionRow) => r.card_spend_monthly },
  debt_balance: { label: "Crédito / dívidas", get: (r: InstitutionRow) => r.debt_balance },
  customers: { label: "Clientes conectados", get: (r: InstitutionRow) => r.customers },
} as const;
type MetricKey = keyof typeof METRICS;

function InstitutionDetailDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const role = useRole();
  const { data, error } = useQuery({ queryKey: ["institution", id, role], queryFn: () => api.institution(id!), enabled: !!id });
  return (
    <Drawer
      open={!!id}
      onClose={onClose}
      width={640}
      title={
        data ? (
          <div className="flex items-center gap-3">
            <InstitutionAvatar institution={data.institution} size="lg" />
            <div>
              <div className="text-[17px] font-bold text-ink">{data.institution.name}</div>
              <div className="text-[12.5px] text-ink-3">
                {data.category_label} · {num(data.customers)} clientes da carteira conectados
              </div>
            </div>
          </div>
        ) : (
          <Skeleton className="h-11 w-60" />
        )
      }
    >
      {error ? (
        <ErrorState error={error} />
      ) : !data ? (
        <Skeleton className="h-[60vh]" />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Saldos", brlCompact(data.account_balance)],
              ["Investimentos", brlCompact(data.investment_balance)],
              ["Dívidas", brlCompact(data.debt_balance)],
              ["Cartão/mês", brlCompact(data.card_spend_monthly)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-surface-2 px-3 py-2.5">
                <div className="text-[12px] text-ink-3">{label}</div>
                <div className="tnum mt-1 text-[16px] font-bold text-[#0a1440]">{value}</div>
              </div>
            ))}
          </div>
          {data.primary_overlap && data.primary_overlap.customers > 0 && (
            <div className="rounded-lg bg-accent-soft/70 p-3.5 text-[13.5px] leading-snug text-ink-2">
              <span className="font-bold text-ink">{num(data.primary_overlap.customers)} clientes</span> recebem salário no banco principal e mantêm aqui{" "}
              <span className="font-bold text-ink">{brlCompact(data.primary_overlap.investments)}</span> em investimentos e{" "}
              <span className="font-bold text-ink">{brlCompact(data.primary_overlap.card_spend_monthly)}/mês</span> em cartão.
            </div>
          )}
          <div>
            <div className="mb-2 text-[12px] font-semibold tracking-[0.08em] text-ink-3 uppercase">Evolução na carteira</div>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={data.monthly.map((m) => ({ label: monthLabel(m.month), Saldos: m.account_balance, Investimentos: m.investment_balance }))}
                  margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={16} />
                  <YAxis width={76} tickLine={false} axisLine={false} tickFormatter={brlCompact} />
                  <Tooltip cursor={{ stroke: "#c9d3e1" }} content={<ChartTooltip />} />
                  <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: "var(--color-ink-2)" }} />
                  <Area type="monotone" dataKey="Saldos" stackId="1" stroke="#2a78d6" strokeWidth={2} fill="#2a78d6" fillOpacity={0.12} isAnimationActive={false} />
                  <Area type="monotone" dataKey="Investimentos" stackId="1" stroke="#eb6834" strokeWidth={2} fill="#eb6834" fillOpacity={0.12} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <div className="mb-2 text-[12px] font-semibold tracking-[0.08em] text-ink-3 uppercase">Produtos na carteira</div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(data.products) as ProductKey[]).map((p) => (
                <Badge key={p} tone="gray">
                  {PRODUCT_META[p].label}: <span className="font-bold text-ink">{num(data.products[p])}</span>
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-[12px] font-semibold tracking-[0.08em] text-ink-3 uppercase">Maiores relacionamentos</div>
            <ul className="divide-y divide-line rounded-lg border border-line">
              {data.top_customers.map((c) => (
                <li key={c.customer_id}>
                  <Link href={`/clientes/${c.customer_id}`} className="flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-surface-2">
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-semibold text-ink">{c.name}</div>
                      <div className="text-[12px] text-ink-3">{c.products.map((p) => PRODUCT_META[p]?.label ?? p).join(" · ")}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {c.top_opportunity_type && <OpportunityPill type={c.top_opportunity_type} short size="sm" />}
                      <span className="tnum text-[13.5px] font-bold text-ink">{brlCompact(c.account_balance + c.investment_balance)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Drawer>
  );
}

export default function InstitutionsPage() {
  const role = useRole();
  const [metric, setMetric] = useState<MetricKey>("total_assets");
  const [open, setOpen] = useState<string | null>(null);
  const { data, error } = useQuery({ queryKey: ["institutions", role], queryFn: api.institutions });
  const exportCsv = useMutation({ mutationFn: () => api.downloadReport("instituicoes") });

  if (error) return <ErrorState error={error} className="mt-24" />;
  const rows = data?.items ?? [];
  const sorted = [...rows].sort((a, b) => METRICS[metric].get(b) - METRICS[metric].get(a));
  const total = rows.reduce((sum, r) => sum + METRICS[metric].get(r), 0) || 1;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Instituições"
        description="Como o dinheiro e os produtos da carteira se distribuem entre o banco principal e as demais instituições"
        actions={
          <Button variant="secondary" onClick={() => exportCsv.mutate()} disabled={exportCsv.isPending}>
            <Download className="size-4" /> Exportar CSV
          </Button>
        }
      />

      <Card>
        <CardHeader
          title="Participação por instituição"
          subtitle="Banco principal em verde · clique em uma instituição para detalhar"
          actions={
            <Segmented
              size="sm"
              value={metric}
              onChange={setMetric}
              options={(Object.keys(METRICS) as MetricKey[]).map((k) => ({ value: k, label: METRICS[k].label.split(" (")[0] }))}
            />
          }
        />
        <div className="px-5 pb-5">
          {data ? (
            <BarList
              onSelect={setOpen}
              color="var(--color-context)"
              items={sorted.map((r) => ({
                key: r.institution.institution_id,
                highlight: r.institution.is_primary,
                label: (
                  <span className="inline-flex items-center gap-2">
                    <InstitutionAvatar institution={r.institution} size="xs" />
                    {r.institution.name}
                    {r.institution.is_primary && (
                      <Badge tone="green" size="sm">
                        Banco principal
                      </Badge>
                    )}
                  </span>
                ),
                value: METRICS[metric].get(r),
                display: metric === "customers" ? num(r.customers) : brlCompact(METRICS[metric].get(r)),
                secondary: pct(METRICS[metric].get(r) / total, 1),
              }))}
            />
          ) : (
            <Skeleton className="h-96" />
          )}
        </div>
      </Card>

      <Card className="mt-4">
        <CardHeader title="Detalhamento" subtitle="Valores somados dos clientes da carteira em cada instituição" />
        <div className="overflow-x-auto px-5 pb-4">
          <table className="w-full min-w-[1000px] text-left text-[13.5px]">
            <thead>
              <tr className="bg-surface-2 text-[12.5px] text-ink-2">
                <th className="rounded-l-lg px-4 py-2.5 font-medium">Instituição</th>
                <th className="px-3 py-2.5 text-right font-medium">Clientes</th>
                <th className="px-3 py-2.5 text-right font-medium">Com salário</th>
                <th className="px-3 py-2.5 text-right font-medium">Saldos</th>
                <th className="px-3 py-2.5 text-right font-medium">Investimentos</th>
                <th className="px-3 py-2.5 text-right font-medium">Dívidas</th>
                <th className="px-3 py-2.5 text-right font-medium">Cartão/mês</th>
                <th className="px-3 py-2.5 text-right font-medium">Share do patrimônio</th>
                <th className="w-10 rounded-r-lg" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.institution.institution_id}
                  onClick={() => setOpen(r.institution.institution_id)}
                  className="cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-[#f9fbfe]"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <InstitutionAvatar institution={r.institution} size="md" />
                      <div>
                        <div className="font-semibold text-ink">{r.institution.name}</div>
                        <div className="text-[12px] text-ink-3">{r.category_label}</div>
                      </div>
                    </div>
                  </td>
                  <td className="tnum px-3 py-3 text-right text-ink">
                    {num(r.customers)} <span className="text-ink-3">({pct(r.customer_share)})</span>
                  </td>
                  <td className="tnum px-3 py-3 text-right text-ink-2">{num(r.salary_customers)}</td>
                  <td className="tnum px-3 py-3 text-right text-ink">{brlCompact(r.account_balance)}</td>
                  <td className="tnum px-3 py-3 text-right text-ink">{brlCompact(r.investment_balance)}</td>
                  <td className="tnum px-3 py-3 text-right text-ink">{brlCompact(r.debt_balance)}</td>
                  <td className="tnum px-3 py-3 text-right text-ink">{brl(r.card_spend_monthly)}</td>
                  <td className="tnum px-3 py-3 text-right font-bold text-ink">{pct(r.share_of_assets, 1)}</td>
                  <td className="pr-4">
                    <ArrowRight className="size-4 text-ink-3" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <InstitutionDetailDrawer id={open} onClose={() => setOpen(null)} />
    </div>
  );
}
