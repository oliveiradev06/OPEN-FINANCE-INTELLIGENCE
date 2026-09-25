"use client";

import { useQuery } from "@tanstack/react-query";
import { FileLock2, ShieldCheck } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarList } from "@/components/charts/BarList";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { Badge } from "@/components/ui/Badge";
import { Drawer } from "@/components/ui/Drawer";
import { InstitutionAvatar } from "@/components/ui/InstitutionAvatar";
import { Meter } from "@/components/ui/Meter";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { api } from "@/lib/api";
import { brl, brlCents, brlCompact, dateBR, monthLabel, pct, rate, relativeTime } from "@/lib/format";
import { PRODUCT_META } from "@/lib/labels";
import { useRole } from "@/lib/role";
import type { InstitutionDrilldown, ProductKey } from "@/lib/types";
import { cn } from "@/lib/utils";

const SCOPE_LABELS: Record<string, string> = {
  contas: "Contas",
  transacoes: "Transações",
  cartoes_credito: "Cartões de crédito",
  investimentos: "Investimentos",
  operacoes_credito: "Operações de crédito",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="mb-2.5 text-[11.5px] font-semibold tracking-[0.12em] text-ink-3 uppercase">{title}</h3>
      {children}
    </section>
  );
}

function Row({ left, right, sub }: { left: React.ReactNode; right: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line/70 py-2.5 last:border-0">
      <div className="min-w-0">
        <div className="text-[13px] text-ink">{left}</div>
        {sub && <div className="text-[12px] text-ink-3">{sub}</div>}
      </div>
      <div className="tnum shrink-0 text-right text-[13px] font-medium text-ink">{right}</div>
    </div>
  );
}

function Content({ data }: { data: InstitutionDrilldown }) {
  const r = data.relationship;
  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Saldo em conta", brlCompact(r.account_balance)],
          ["Investimentos", brlCompact(r.investment_balance)],
          ["Dívidas", brlCompact(r.debt_balance)],
          ["Gasto médio/mês", brlCompact(data.avg_monthly_spend)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-line bg-surface px-3 py-2.5">
            <div className="text-[11.5px] text-ink-3">{label}</div>
            <div className="mt-1 text-[16px] font-semibold text-ink">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {r.products.map((p) => (
          <Badge key={p} className={p === "salario" ? "bg-accent/12 text-accent-soft ring-accent/25" : undefined}>
            {PRODUCT_META[p as ProductKey]?.label ?? p}
          </Badge>
        ))}
      </div>

      {data.accounts.length > 0 && (
        <Section title="Contas">
          {data.accounts.map((a) => (
            <Row key={a.account_id} left={a.label} sub={`Aberta em ${dateBR(a.opened_at)} · saldo médio 6m ${brl(a.average_balance)}`} right={brl(a.balance)} />
          ))}
        </Section>
      )}

      {data.cards.length > 0 && (
        <Section title="Cartões">
          {data.cards.map((c) => (
            <div key={c.card_id} className="border-b border-line/70 py-2.5 last:border-0">
              <div className="flex justify-between text-[13px]">
                <span className="text-ink">
                  {c.brand} {c.tier}
                </span>
                <span className="tnum font-medium text-ink">{brl(c.monthly_bill)} <span className="font-normal text-ink-3">/ mês</span></span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-[12px] text-ink-3">
                <Meter value={c.utilization} color={c.utilization > 0.8 ? "var(--color-warning)" : "var(--color-blue)"} className="flex-1" />
                <span className="tnum">
                  {pct(c.utilization)} de {brl(c.credit_limit)}
                </span>
              </div>
            </div>
          ))}
        </Section>
      )}

      {data.investments.length > 0 && (
        <Section title="Investimentos">
          {data.investments.map((i) => (
            <Row key={i.investment_id} left={i.product_name} sub={`${i.label} · risco ${i.risk_category} · liquidez ${i.liquidity}`} right={brl(i.balance)} />
          ))}
        </Section>
      )}

      {data.loans.length > 0 && (
        <Section title="Empréstimos e financiamentos">
          {data.loans.map((l) => (
            <Row
              key={l.loan_id}
              left={
                <span className="flex items-center gap-2">
                  {l.label}
                  {l.expensive && <Badge className="bg-critical/15 text-[#f07171] ring-critical/30">Dívida cara</Badge>}
                </span>
              }
              sub={`${rate(l.interest_rate)} · parcela ${brl(l.installment)}${l.remaining_months ? ` · ${l.remaining_months} meses restantes` : " · crédito rotativo"}`}
              right={brl(l.balance)}
            />
          ))}
        </Section>
      )}

      {data.spending_by_category.length > 0 && (
        <Section title="Gastos por categoria (média mensal, 3 meses)">
          <BarList
            items={data.spending_by_category.slice(0, 7).map((c) => ({
              key: c.category,
              label: c.label,
              value: c.value,
              display: brl(c.value),
              secondary: pct(c.share),
            }))}
          />
        </Section>
      )}

      {data.monthly.length > 0 && (
        <Section title="Entradas e saídas nesta instituição">
          <div className="h-[190px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthly.map((m) => ({ label: monthLabel(m.month), Entradas: m.inflow, Saídas: m.outflow }))} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barGap={2}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={12} />
                <YAxis width={76} tickLine={false} axisLine={false} tickFormatter={brlCompact} />
                <Tooltip cursor={{ fill: "rgb(255 255 255 / 0.03)" }} content={<ChartTooltip />} />
                <Legend iconType="rect" iconSize={8} wrapperStyle={{ fontSize: 12, color: "var(--color-ink-2)" }} />
                <Bar dataKey="Entradas" fill="var(--color-blue)" radius={[4, 4, 0, 0]} maxBarSize={10} isAnimationActive={false} />
                <Bar dataKey="Saídas" fill="var(--color-orange)" radius={[4, 4, 0, 0]} maxBarSize={10} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      )}

      <Section title="Transações recentes">
        <div className="overflow-hidden rounded-lg border border-line">
          <table className="w-full text-[12.5px]">
            <tbody>
              {data.transactions.map((t) => (
                <tr key={t.transaction_id} className="border-b border-line/70 last:border-0">
                  <td className="tnum px-3 py-2 whitespace-nowrap text-ink-3">{dateBR(t.date).slice(0, 5)}</td>
                  <td className="px-2 py-2">
                    <div className="text-ink">{t.description}</div>
                    <div className="text-[11.5px] text-ink-3">{t.category_label}</div>
                  </td>
                  <td className={cn("tnum px-3 py-2 text-right font-medium whitespace-nowrap", t.amount > 0 ? "text-[#5fd35f]" : "text-ink")}>
                    {t.amount > 0 ? "+" : "−"} {brlCents(Math.abs(t.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Consentimento e LGPD">
        {data.institution.is_primary ? (
          <div className="flex gap-2 rounded-lg border border-line bg-surface p-3 text-[12.5px] text-ink-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" />
            Dados do próprio banco — não dependem de compartilhamento Open Finance.
          </div>
        ) : data.consent ? (
          <div className="rounded-lg border border-line bg-surface p-3 text-[12.5px]">
            <div className="flex items-center gap-2 text-ink">
              <FileLock2 className="size-4 text-accent" /> Consentimento {data.consent.status === "expiring" ? "expira em breve" : "ativo"}
              <span className="text-ink-3">· {data.consent.consent_id}</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-ink-3">
              <span>Concedido em <span className="text-ink-2">{dateBR(data.consent.granted_at)}</span></span>
              <span>Expira em <span className="text-ink-2">{dateBR(data.consent.expires_at)}</span></span>
              {data.consent.last_sync_at && (
                <span>Última sincronização <span className="text-ink-2">{relativeTime(data.consent.last_sync_at)}</span></span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {data.consent.scopes.map((s) => (
                <Badge key={s}>{SCOPE_LABELS[s] ?? s}</Badge>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-ink-3">Finalidade: {data.consent.purpose}.</p>
          </div>
        ) : null}
      </Section>
    </>
  );
}

export function InstitutionDrawer({
  customerId,
  institutionId,
  onClose,
}: {
  customerId: string;
  institutionId: string | null;
  onClose: () => void;
}) {
  const role = useRole();
  const query = useQuery({
    queryKey: ["customer-institution", customerId, institutionId, role],
    queryFn: () => api.customerInstitution(customerId, institutionId!),
    enabled: !!institutionId,
  });
  const inst = query.data?.institution;
  return (
    <Drawer
      open={!!institutionId}
      onClose={onClose}
      width={600}
      title={
        inst ? (
          <div className="flex items-center gap-3">
            <InstitutionAvatar institution={inst} size="lg" />
            <div>
              <div className="text-[17px] font-semibold text-ink">{inst.name}</div>
              <div className="text-[12.5px] text-ink-3">{inst.is_primary ? "Banco principal · dados internos" : "Dados compartilhados via Open Finance"}</div>
            </div>
          </div>
        ) : (
          <Skeleton className="h-11 w-60" />
        )
      }
    >
      {query.error ? <ErrorState error={query.error} /> : query.data ? <Content data={query.data} /> : <Skeleton className="h-[60vh]" />}
    </Drawer>
  );
}
