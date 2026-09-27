"use client";

import { ArrowRight, ChartColumnBig, Handshake, HeartPulse, Landmark, Network, UsersRound } from "lucide-react";
import Link from "next/link";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { Donut } from "@/components/charts/Donut";
import { IconTile } from "@/components/ui/Avatar";
import { Card, CardHeader } from "@/components/ui/Card";
import { InstitutionAvatar } from "@/components/ui/InstitutionAvatar";
import { Gauge } from "@/components/ui/Meter";
import { OpportunityPill } from "@/components/ui/OpportunityTag";
import { HoverPopover } from "@/components/ui/Popover";
import { ScoreDetails, ScoreExplain } from "@/components/ui/ScoreExplain";
import { brl, brlCompact, monthShort, num } from "@/lib/format";
import { BAND_META, OPPORTUNITY_META, potentialLabel, scoreTone } from "@/lib/labels";
import { TONES, type Tone } from "@/lib/tones";
import type { Customer360, EcosystemNode, Opportunity } from "@/lib/types";

const GAUGE_COLORS: Record<string, [string, string, string]> = {
  green: ["#3cc583", "#15a06a", "#0b6b5e"],
  amber: ["#f7c65a", "#eda100", "#b97a00"],
  gray: ["#c3ccda", "#8491a6", "#5d6a82"],
};

/** "Score e perfil": the top Opportunity Score on a gauge; hovering it shows how it was built. */
export function ScoreProfileCard({ data }: { data: Customer360 }) {
  const top = data.opportunities[0];
  const score = top?.score ?? 0;
  const tone = scoreTone(score);
  const gauge = <Gauge value={score} colors={GAUGE_COLORS[tone] ?? GAUGE_COLORS.gray} label={`Opportunity Score ${score}`} />;
  return (
    <Card className="flex h-full flex-col p-5">
      <h2 className="text-[15.5px] font-semibold tracking-tight text-[#0e1a3a]">Score e perfil</h2>
      <div className="mt-3 flex flex-1 flex-col items-center text-center">
        {top ? (
          <HoverPopover width={340} trigger={gauge}>
            <ScoreDetails score={top.score} title={top.type_label} factors={top.score_breakdown} reasons={top.evidence} />
          </HoverPopover>
        ) : (
          gauge
        )}
        <div className="mt-1 text-[15px] font-bold" style={{ color: TONES[tone === "gray" ? "gray" : tone].ink }}>
          {potentialLabel(score)}
        </div>
        <p className="mt-2 max-w-[260px] text-[13px] leading-snug text-ink-2">
          {top
            ? `Maior oportunidade em ${OPPORTUNITY_META[top.type].label.toLowerCase()}: ${top.summary}`
            : "Nenhuma oportunidade acima do score mínimo de 45 para este cliente."}
        </p>
      </div>
    </Card>
  );
}

function InfoItem({ icon, tone, label, value, hint }: { icon: typeof Landmark; tone: Tone; label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-center gap-3" title={hint}>
      <IconTile icon={icon} tone={tone} size="md" />
      <div className="min-w-0">
        <div className="text-[12.5px] text-ink-3">{label}</div>
        <div className="text-[14.5px] leading-snug font-semibold text-ink">{value}</div>
      </div>
    </div>
  );
}

export function InfoGrid({ data }: { data: Customer360 }) {
  const { metrics, customer, health } = data;
  const band = BAND_META[health.band];
  const years = customer.tenure_years;
  const tenure = years >= 1 ? `Cliente há ${Math.floor(years)} ${Math.floor(years) === 1 ? "ano" : "anos"}` : `Cliente há ${Math.max(1, Math.round(years * 12))} meses`;
  return (
    <Card className="h-full p-5">
      <h2 className="text-[15.5px] font-semibold tracking-tight text-[#0e1a3a]">Informações principais</h2>
      <div className="mt-4 grid gap-x-6 gap-y-5 sm:grid-cols-2">
        <InfoItem icon={ChartColumnBig} tone="blue" label="Renda mensal" value={brl(metrics.monthly_income)} />
        <InfoItem icon={Landmark} tone="teal" label="Patrimônio estimado" value={brl(metrics.total_assets)} />
        <InfoItem icon={UsersRound} tone="blue" label="Segmento" value={customer.segment} hint={data.segment ? `Segmento comportamental: ${data.segment.name}` : undefined} />
        <InfoItem icon={Handshake} tone="blue" label="Relacionamento" value={tenure} />
        <InfoItem icon={HeartPulse} tone={band.tone} label="Saúde financeira" value={`${health.score} · ${band.label}`} />
        <InfoItem icon={Network} tone="green" label="Open Finance" value={`${metrics.institutions_count} instituições conectadas`} />
      </div>
    </Card>
  );
}

const TOTAL = { name: "Patrimônio total", color: "#4a96f5" };
const PRIMARY = { name: "No banco principal", color: "#138a4f" };

/** Last 6 months: total wealth (bars) and the part kept at the primary bank (line), both in R$. */
export function RelationshipEvolution({ timeline }: { timeline: Customer360["timeline"] }) {
  const data = timeline.slice(-6).map((t) => ({
    label: monthShort(t.month),
    [TOTAL.name]: t.balance_primary + t.balance_external + t.investments_primary + t.investments_external,
    [PRIMARY.name]: t.balance_primary + t.investments_primary,
  }));
  return (
    <Card className="flex h-full flex-col p-5">
      <h2 className="text-[15.5px] font-semibold tracking-tight text-[#0e1a3a]">Evolução do relacionamento</h2>
      <div className="mt-2 flex flex-wrap gap-x-4 text-[12.5px] text-ink-2">
        {[PRIMARY, TOTAL].map((s) => (
          <span key={s.name} className="flex items-center gap-1.5">
            <span className="size-2 rotate-45 rounded-[2px]" style={{ backgroundColor: s.color }} /> {s.name}
          </span>
        ))}
      </div>
      <div className="mt-2 min-h-[180px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 6, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis width={78} tickLine={false} axisLine={false} tickFormatter={brlCompact} />
            <Tooltip cursor={{ fill: "rgb(20 108 236 / 0.05)" }} content={<ChartTooltip />} />
            <Bar dataKey={TOTAL.name} fill={TOTAL.color} radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
            <Line
              type="linear"
              dataKey={PRIMARY.name}
              stroke={PRIMARY.color}
              strokeWidth={2.5}
              dot={{ r: 4, fill: PRIMARY.color, stroke: "#fff", strokeWidth: 1.5 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function EcosystemTiles({ nodes, onOpen, onShowMap }: { nodes: EcosystemNode[]; onOpen: (id: string) => void; onShowMap: () => void }) {
  const shown = nodes.slice(0, 5);
  const rest = nodes.length - shown.length;
  return (
    <Card className="h-full">
      <CardHeader
        title="Ecossistema financeiro (Open Finance)"
        subtitle="Saldo e investimentos do cliente em cada instituição conectada"
        actions={
          <button type="button" onClick={onShowMap} className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary-ink hover:underline">
            Ver mapa <ArrowRight className="size-3.5" />
          </button>
        }
      />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(112px,1fr))] gap-3 px-5 pb-5">
        {shown.map((n) => (
          <button
            key={n.institution.institution_id}
            type="button"
            onClick={() => onOpen(n.institution.institution_id)}
            className="flex flex-col items-center gap-2 rounded-xl border border-line px-2 py-4 text-center transition-colors hover:border-primary/30 hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
          >
            <InstitutionAvatar institution={n.institution} size="xl" />
            <span className="w-full truncate text-[13px] text-ink-2">{n.institution.short_name}</span>
            <span className="tnum text-[13.5px] font-bold text-ink">{brl(n.account_balance + n.investment_balance)}</span>
            {n.institution.is_primary && <span className="-mt-1 text-[11px] font-semibold text-accent-ink">Banco principal</span>}
          </button>
        ))}
        {rest > 0 && (
          <button
            type="button"
            onClick={onShowMap}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong px-2 py-4 text-center hover:bg-surface-2"
          >
            <span className="grid size-12 place-items-center rounded-xl bg-primary-soft text-[16px] font-bold text-primary-ink">+{rest}</span>
            <span className="text-[12px] text-ink-3">outras instituições</span>
          </button>
        )}
      </div>
    </Card>
  );
}

// Validated categorical order on white: aqua, amber, blue, magenta, violet.
const ASSET_COLORS: Record<string, string> = {
  conta: "#1baf7a",
  poupanca: "#eda100",
  renda_fixa: "#2a78d6",
  renda_variavel: "#e87ba4",
  previdencia: "#4a3aa7",
};

export function AssetDonut({ data }: { data: Customer360 }) {
  const total = data.asset_breakdown.reduce((sum, s) => sum + s.value, 0);
  return (
    <Card className="h-full">
      <CardHeader title="Distribuição do patrimônio" subtitle="Por grupo de produto, somando todas as instituições" />
      <div className="px-5 pb-5">
        <Donut
          size={168}
          thickness={24}
          centerValue={brl(total)}
          centerLabel="total"
          centerClassName="text-[16px]"
          valueFormatter={brl}
          slices={data.asset_breakdown.map((s) => ({ key: s.key, label: s.label, value: s.value, color: ASSET_COLORS[s.key] ?? "#8491a6" }))}
        />
      </div>
    </Card>
  );
}

export function OpportunityRows({ opportunities, onShowAll }: { opportunities: Opportunity[]; onShowAll: () => void }) {
  return (
    <Card className="h-full">
      <CardHeader
        title="Oportunidades identificadas"
        subtitle={`${num(opportunities.length)} detectada${opportunities.length === 1 ? "" : "s"} pelo motor — passe o mouse no score para ver os motivos`}
        actions={
          opportunities.length > 0 && (
            <button type="button" onClick={onShowAll} className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary-ink hover:underline">
              Ver detalhes <ArrowRight className="size-3.5" />
            </button>
          )
        }
      />
      {opportunities.length === 0 ? (
        <p className="px-5 pb-5 text-[13px] text-ink-3">Nenhuma oportunidade acima do score mínimo para este cliente.</p>
      ) : (
        <ul className="divide-y divide-line px-5 pb-3">
          {opportunities.map((o) => {
            const meta = OPPORTUNITY_META[o.type];
            return (
              <li key={o.opportunity_id} className="flex items-center gap-3 py-3">
                <IconTile icon={meta.icon} tone={meta.tone} size="md" className="rounded-xl" />
                <div className="min-w-0 flex-1">
                  <Link href={`/oportunidades/${o.opportunity_id}`} className="block truncate text-[14px] font-semibold text-ink hover:text-primary-ink">
                    {o.title}
                  </Link>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3">
                    <OpportunityPill type={o.type} size="sm" />
                    {meta.valueLabel}: <span className="tnum font-semibold text-ink-2">{brl(o.estimated_value)}</span>
                  </div>
                </div>
                <ScoreExplain score={o.score} title={o.type_label} factors={o.score_breakdown} reasons={o.evidence} />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
