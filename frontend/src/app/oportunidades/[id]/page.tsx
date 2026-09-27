"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Banknote,
  Calculator,
  CircleCheck,
  CircleDot,
  Ellipsis,
  Flag,
  Handshake,
  Hash,
  Info,
  Lock,
  Percent,
  PhoneCall,
  Search,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  Wallet,
  WandSparkles,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { OpportunityViz, PrimaryViz } from "@/components/opportunity/OpportunityViz";
import { IconTile } from "@/components/ui/Avatar";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Dropdown, MenuDivider, MenuItem, MenuLabel } from "@/components/ui/Dropdown";
import { OpportunityPill, StatusBadge } from "@/components/ui/OpportunityTag";
import { BackLink } from "@/components/ui/PageHeader";
import { HoverPopover } from "@/components/ui/Popover";
import { ScoreDetails, ScoreExplain } from "@/components/ui/ScoreExplain";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { Tabs } from "@/components/ui/Tabs";
import { ApiError, api } from "@/lib/api";
import { brl, dateBR, dateTimeBR, formatMetric, num } from "@/lib/format";
import { useCan } from "@/lib/hooks";
import { BAND_META, OPPORTUNITY_META, PRIORITY_META, STATUS_META, scoreTone } from "@/lib/labels";
import { useRole } from "@/lib/role";
import { TONES, type Tone } from "@/lib/tones";
import type { MetricValue, OpportunityDetail, OpportunityStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACTIONS: { status: OpportunityStatus; label: string; icon: typeof Search }[] = [
  { status: "in_review", label: "Iniciar análise", icon: Search },
  { status: "contacted", label: "Cliente contatado", icon: PhoneCall },
  { status: "converted", label: "Convertida", icon: Handshake },
  { status: "dismissed", label: "Descartar", icon: XCircle },
];

const TABS = ["visao-geral", "analise", "dados", "recomendacao", "historico"] as const;
type Tab = (typeof TABS)[number];

function useStatusMutation(o: OpportunityDetail) {
  const role = useRole();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ status, note }: { status: OpportunityStatus; note?: string }) => api.updateOpportunity(o.opportunity_id, status, note),
    onSuccess: (updated) => {
      client.setQueryData(["opportunity", o.opportunity_id, role], updated);
      client.invalidateQueries({ queryKey: ["opportunities"] });
      client.invalidateQueries({ queryKey: ["opportunities-summary"] });
      client.invalidateQueries({ queryKey: ["customer", o.customer_id] });
    },
  });
}

export default function OpportunityDetailPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[70vh] rounded-xl" />}>
      <OpportunityView />
    </Suspense>
  );
}

function OpportunityView() {
  const { id } = useParams<{ id: string }>();
  const role = useRole();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { data: o, error } = useQuery({ queryKey: ["opportunity", id, role], queryFn: () => api.opportunity(id) });

  const requested = params.get("tab") as Tab | null;
  const tab: Tab = requested && TABS.includes(requested) ? requested : "visao-geral";
  const setTab = (next: string) => router.replace(next === "visao-geral" ? pathname : `${pathname}?tab=${next}`, { scroll: false });

  if (error) return <ErrorState error={error} className="mt-24" />;
  if (!o) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 rounded-xl" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <Header o={o} onTab={setTab} />
      <Tabs
        className="mb-5"
        value={tab}
        onChange={setTab}
        items={[
          { value: "visao-geral", label: "Visão geral" },
          { value: "analise", label: "Análise" },
          { value: "dados", label: "Dados de Open Finance" },
          { value: "recomendacao", label: "Recomendação" },
          { value: "historico", label: "Histórico" },
        ]}
      />
      {tab === "visao-geral" && <OverviewTab o={o} onTab={setTab} />}
      {tab === "analise" && <AnalysisTab o={o} />}
      {tab === "dados" && <DataTab o={o} />}
      {tab === "recomendacao" && <RecommendationTab o={o} />}
      {tab === "historico" && <HistoryTab o={o} />}
    </div>
  );
}

function Header({ o, onTab }: { o: OpportunityDetail; onTab: (tab: string) => void }) {
  const meta = OPPORTUNITY_META[o.type];
  const canUpdate = useCan("opportunities:update");
  const mutation = useStatusMutation(o);
  const tone = scoreTone(o.score);
  return (
    <div className="mb-4">
      <BackLink href="/oportunidades" />
      <div className="mt-1 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <IconTile icon={meta.icon} tone={meta.tone} size="xl" className="size-16 rounded-2xl [&>svg]:size-7" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1 className="text-[24px] leading-tight font-bold tracking-tight text-heading">{o.title}</h1>
              <OpportunityPill type={o.type} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-ink-2">
              <span>
                Cliente:{" "}
                <Link href={`/clientes/${o.customer_id}`} className="font-medium text-ink hover:text-primary-ink">
                  {o.customer.name}
                </Link>
              </span>
              <span className="h-4 w-px bg-line-strong" />
              <span className="tnum">{o.customer_id}</span>
              <span className="h-4 w-px bg-line-strong" />
              <span>Identificada em {dateBR(o.created_at)}</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-3 sm:items-end">
          <HoverPopover
            width={340}
            trigger={
              <span className="flex items-baseline gap-3 rounded-xl px-5 py-2" style={{ backgroundColor: TONES[tone].bg }}>
                <span className="text-[14px] font-medium text-ink-2">Score</span>
                <span className="tnum text-[32px] leading-none font-bold text-[#0a1440]">{o.score}</span>
              </span>
            }
          >
            <ScoreDetails score={o.score} title={o.type_label} factors={o.score_breakdown} reasons={o.evidence} />
          </HoverPopover>
          <div className="flex items-center gap-2.5">
            <ButtonLink variant="primary" size="lg" href={`/simulador?opportunity=${o.opportunity_id}`} className="h-11 px-6">
              <Calculator className="size-4" /> Simular proposta
            </ButtonLink>
            <Dropdown
              label="Mais ações"
              width={250}
              triggerClassName="grid size-11 place-items-center rounded-lg border border-line-strong bg-white text-ink-2 hover:bg-surface-2"
              trigger={<Ellipsis className="size-5" />}
            >
              {(close) => (
                <>
                  <MenuItem icon={UserRound} href={`/clientes/${o.customer_id}`} onSelect={close}>
                    Abrir Customer 360
                  </MenuItem>
                  <MenuItem
                    icon={Flag}
                    onSelect={() => {
                      onTab("recomendacao");
                      close();
                    }}
                  >
                    Ver ação recomendada
                  </MenuItem>
                  {canUpdate && (
                    <>
                      <MenuDivider />
                      <MenuLabel>Alterar status</MenuLabel>
                      {ACTIONS.filter((a) => a.status !== o.status).map(({ status, label, icon }) => (
                        <MenuItem
                          key={status}
                          icon={icon}
                          danger={status === "dismissed"}
                          onSelect={() => {
                            mutation.mutate({ status });
                            close();
                          }}
                        >
                          {label}
                        </MenuItem>
                      ))}
                    </>
                  )}
                </>
              )}
            </Dropdown>
          </div>
        </div>
      </div>
    </div>
  );
}

function metricIcon(metric: MetricValue): { icon: typeof Wallet; tone: Tone } {
  if (metric.format === "currency") return { icon: Banknote, tone: "blue" };
  if (metric.format === "percent") return { icon: Percent, tone: "teal" };
  if (metric.format === "rate") return { icon: Percent, tone: "amber" };
  if (metric.format === "number") return { icon: Hash, tone: "blue" };
  return { icon: Info, tone: "gray" };
}

function MetricTile({ icon, tone, label, value, valueClass }: { icon: typeof Wallet; tone: Tone; label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-3">
      <IconTile icon={icon} tone={tone} size="md" />
      <div className="min-w-0">
        <div className="line-clamp-2 text-[12px] leading-snug text-ink-3">{label}</div>
        <div className={cn("tnum truncate text-[15px] font-bold text-ink", valueClass)}>{value}</div>
      </div>
    </div>
  );
}

function OverviewTab({ o, onTab }: { o: OpportunityDetail; onTab: (tab: string) => void }) {
  const meta = OPPORTUNITY_META[o.type];
  const priority = PRIORITY_META[o.priority];
  const status = STATUS_META[o.status];
  const metrics = o.metrics.filter((m) => !(m.format === "currency" && Number(m.value) === o.estimated_value)).slice(0, 3);
  const support = o.evidence.filter((e) => e.kind === "support").slice(0, 3);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="p-5">
          <h2 className="text-[15.5px] font-semibold tracking-tight text-[#0e1a3a]">Resumo da oportunidade</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{o.summary}</p>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2 2xl:grid-cols-3">
            <MetricTile icon={Wallet} tone="blue" label={meta.valueLabel} value={brl(o.estimated_value)} />
            {metrics.map((m) => (
              <MetricTile key={m.key} {...metricIcon(m)} label={m.label} value={formatMetric(m)} />
            ))}
            <MetricTile icon={Flag} tone={priority.tone} label="Prioridade" value={priority.label} valueClass="" />
            <MetricTile icon={CircleDot} tone={status.tone} label="Status" value={status.label} />
          </div>
        </Card>
        <Card className="p-5">
          <PrimaryViz opportunity={o} />
        </Card>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Evidências principais"
            subtitle="Fatos dos dados do cliente que dispararam a regra"
            actions={
              <button type="button" onClick={() => onTab("analise")} className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary-ink hover:underline">
                Ver análise completa <ArrowRight className="size-3.5" />
              </button>
            }
          />
          <ul className="space-y-2.5 px-5 pb-5">
            {support.map((e) => (
              <li key={e.text} className="flex gap-2.5 text-[13.5px] leading-snug text-ink">
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-accent" />
                {e.text}
              </li>
            ))}
          </ul>
        </Card>
        <Card className="border-ai/20 bg-gradient-to-b from-ai-soft/70 to-white">
          <CardHeader title="Por que esta oportunidade foi detectada" icon={<WandSparkles className="size-4 text-ai" />} />
          <p className="px-5 pb-5 text-[14px] leading-relaxed text-ink">{o.explanation}</p>
        </Card>
      </div>
    </div>
  );
}

function AnalysisTab({ o }: { o: OpportunityDetail }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Evidências" subtitle="Fatos que dispararam a regra, extraídos dos dados do cliente" />
          <ul className="space-y-3 px-5 pb-5">
            {o.evidence.map((e) => (
              <li key={e.text} className="flex gap-2.5 text-[13.5px] leading-snug">
                {e.kind === "caution" ? (
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                ) : e.kind === "context" ? (
                  <Info className="mt-0.5 size-4 shrink-0 text-ink-3" />
                ) : (
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-accent" />
                )}
                <span className={cn(e.kind === "support" ? "text-ink" : "text-ink-2")}>{e.text}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title={`Composição do score · ${o.score}/100`} subtitle="Cada fator vale no máximo o peso indicado" actions={<ScoreExplain score={o.score} title={o.type_label} factors={o.score_breakdown} reasons={o.evidence} />} />
          <div className="space-y-3.5 px-5 pb-5">
            {o.score_breakdown.map((f) => (
              <div key={f.key}>
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="font-semibold text-ink">{f.label}</span>
                  <span className="tnum text-ink-3">
                    <span className="font-bold text-ink">{num(f.points, 1)}</span> / {f.max_points}
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-primary-soft">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(f.points / f.max_points) * 100}%` }} />
                </div>
                <div className="mt-1 text-[12.5px] text-ink-3">{f.detail}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card className="border-ai/20 bg-gradient-to-b from-ai-soft/70 to-white">
        <CardHeader title="Explicação em linguagem natural" icon={<WandSparkles className="size-4 text-ai" />} subtitle="Texto gerado apenas a partir das evidências e da composição do score" />
        <p className="px-5 pb-5 text-[14px] leading-relaxed text-ink">{o.explanation}</p>
      </Card>
    </div>
  );
}

function DataTab({ o }: { o: OpportunityDetail }) {
  const band = BAND_META[o.customer.health_band];
  const c = o.customer;
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,8fr)_minmax(0,3.2fr)]">
      <Card className="p-5">
        <OpportunityViz opportunity={o} />
      </Card>
      <Card>
        <CardHeader title="Cliente" subtitle={`${c.segment} · ${c.age_range} anos · ${c.occupation_category}`} />
        <div className="space-y-3 px-5 pb-5 text-[13.5px]">
          {[
            ["Renda mensal", brl(c.monthly_income)],
            ["Patrimônio", brl(c.total_assets)],
            ["Dívidas", brl(c.total_debt)],
            ["Instituições conectadas", String(c.institutions_count)],
            ["Tempo de relacionamento", `${num(c.tenure_years, 1)} anos`],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3 border-b border-line pb-2.5">
              <span className="text-ink-3">{label}</span>
              <span className="tnum font-semibold text-ink">{value}</span>
            </div>
          ))}
          <div className="flex justify-between gap-3">
            <span className="text-ink-3">Saúde financeira</span>
            <span className="font-semibold" style={{ color: TONES[band.tone].ink }}>
              {c.health_score} · {band.label}
            </span>
          </div>
          <Link href={`/clientes/${c.customer_id}`} className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-primary-ink hover:underline">
            Abrir Customer 360 <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </Card>
    </div>
  );
}

function Workflow({ o }: { o: OpportunityDetail }) {
  const canUpdate = useCan("opportunities:update");
  const [note, setNote] = useState("");
  const mutation = useStatusMutation(o);
  if (!canUpdate) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-ink-3">
        <Lock className="size-4 text-warning" /> Seu perfil não pode alterar o status desta oportunidade.
      </div>
    );
  }
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-[13px] text-ink-2">
        Status atual: <StatusBadge status={o.status} />
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={300}
        placeholder="Observação para a trilha de auditoria (opcional)"
        className="h-10 w-full rounded-lg border border-line-strong bg-white px-3 text-[13px] text-ink outline-none placeholder:text-ink-3 focus:border-primary/60 focus:ring-3 focus:ring-primary/10"
      />
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        {ACTIONS.map(({ status, label, icon: Icon }) => (
          <Button
            key={status}
            size="md"
            variant={opportunityVariant(o.status, status)}
            disabled={mutation.isPending || o.status === status}
            onClick={() => mutation.mutate({ status, note: note || undefined }, { onSuccess: () => setNote("") })}
          >
            <Icon className="size-4" /> {label}
          </Button>
        ))}
      </div>
      {mutation.error && <p className="mt-2 text-[12.5px] text-critical">{mutation.error instanceof ApiError ? mutation.error.message : "Falha ao atualizar."}</p>}
      <p className="mt-2.5 text-[12px] text-ink-3">Cada mudança de status é registrada na auditoria com analista, data e observação.</p>
    </div>
  );
}

function opportunityVariant(current: OpportunityStatus, target: OpportunityStatus) {
  if (current === target) return "soft" as const;
  return target === "dismissed" ? ("ghost" as const) : ("secondary" as const);
}

function RecommendationTab({ o }: { o: OpportunityDetail }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Card>
          <CardHeader title="Ação recomendada ao analista" />
          <div className="px-5 pb-5">
            <p className="text-[14px] leading-relaxed text-ink">{o.recommended_action}</p>
            <div className="mt-4 flex gap-2.5 rounded-lg bg-accent-soft/60 p-3.5 text-[13px] leading-snug text-ink-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" /> {o.guardrail}
            </div>
            <ButtonLink variant="primary" href={`/simulador?opportunity=${o.opportunity_id}`} className="mt-4">
              <Calculator className="size-4" /> Simular proposta
            </ButtonLink>
          </div>
        </Card>
        <Card>
          <CardHeader title="Workflow" subtitle="Registre o andamento da abordagem" />
          <div className="px-5 pb-5">
            <Workflow o={o} />
          </div>
        </Card>
      </div>
      {o.related.length > 0 && (
        <Card>
          <CardHeader title="Outras oportunidades do cliente" />
          <ul className="divide-y divide-line px-5 pb-3">
            {o.related.map((r) => {
              const meta = OPPORTUNITY_META[r.type];
              return (
                <li key={r.opportunity_id}>
                  <Link href={`/oportunidades/${r.opportunity_id}`} className="flex items-center gap-3 py-3 hover:text-primary-ink">
                    <IconTile icon={meta.icon} tone={meta.tone} size="md" className="rounded-xl" />
                    <span className="min-w-0 flex-1 text-[14px] font-semibold text-ink">{meta.label}</span>
                    <StatusBadge status={r.status} />
                    <span className="tnum w-28 text-right text-[13.5px] text-ink-2">{brl(r.estimated_value)}</span>
                    <span className="tnum w-10 text-right text-[14px] font-bold text-ink">{r.score}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

function HistoryTab({ o }: { o: OpportunityDetail }) {
  return (
    <Card>
      <CardHeader title="Histórico da oportunidade" subtitle="Detecção pelo motor e cada mudança de status registrada na auditoria" />
      <ol className="relative mx-5 mb-6 border-l-2 border-line pl-6">
        {o.history.map((event, i) => {
          const detected = event.kind === "detected";
          const to = event.to_status ? STATUS_META[event.to_status] : null;
          return (
            <li key={`${event.timestamp}-${i}`} className="relative pb-6 last:pb-0">
              <span
                className="absolute top-0.5 -left-[33px] grid size-4 place-items-center rounded-full ring-4 ring-white"
                style={{ backgroundColor: detected ? "#2a78d6" : TONES[to?.tone ?? "gray"].solid }}
              />
              <div className="text-[14px] font-semibold text-ink">
                {detected ? "Oportunidade detectada pelo motor" : `Status alterado para “${to?.label ?? event.to_status}”`}
              </div>
              <div className="mt-0.5 text-[12.5px] text-ink-3">
                {dateTimeBR(event.timestamp)} · {event.actor}
                {event.role ? ` (${event.role})` : ""}
                {!detected && event.from_status && ` · antes: ${STATUS_META[event.from_status]?.label ?? event.from_status}`}
              </div>
              {event.note && <div className="mt-1.5 rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-ink-2">{event.note}</div>}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
