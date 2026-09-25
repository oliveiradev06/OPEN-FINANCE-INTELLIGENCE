"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  Handshake,
  Info,
  Lock,
  PhoneCall,
  Search,
  ShieldCheck,
  TriangleAlert,
  WandSparkles,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { OpportunityViz } from "@/components/opportunity/OpportunityViz";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ScoreRing } from "@/components/ui/Meter";
import { OpportunityTag, PriorityBadge, StatusBadge } from "@/components/ui/OpportunityTag";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { ApiError, api } from "@/lib/api";
import { brl, dateTimeBR, formatMetric, num } from "@/lib/format";
import { useCan } from "@/lib/hooks";
import { BAND_META, OPPORTUNITY_META } from "@/lib/labels";
import { useRole } from "@/lib/role";
import type { OpportunityDetail, OpportunityStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACTIONS: { status: OpportunityStatus; label: string; icon: typeof Search }[] = [
  { status: "in_review", label: "Iniciar análise", icon: Search },
  { status: "contacted", label: "Cliente contatado", icon: PhoneCall },
  { status: "converted", label: "Convertida", icon: Handshake },
  { status: "dismissed", label: "Descartar", icon: XCircle },
];

function Workflow({ opportunity }: { opportunity: OpportunityDetail }) {
  const role = useRole();
  const client = useQueryClient();
  const canUpdate = useCan("opportunities:update");
  const [note, setNote] = useState("");
  const mutation = useMutation({
    mutationFn: (status: OpportunityStatus) => api.updateOpportunity(opportunity.opportunity_id, status, note || undefined),
    onSuccess: (updated) => {
      client.setQueryData(["opportunity", opportunity.opportunity_id, role], updated);
      client.invalidateQueries({ queryKey: ["opportunities"] });
      client.invalidateQueries({ queryKey: ["opportunities-summary"] });
      client.invalidateQueries({ queryKey: ["customer", opportunity.customer_id] });
      setNote("");
    },
  });
  if (!canUpdate) {
    return (
      <div className="flex items-center gap-2 text-[12.5px] text-ink-3">
        <Lock className="size-3.5 text-warning" /> Seu perfil não pode alterar o status desta oportunidade.
      </div>
    );
  }
  return (
    <div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={300}
        placeholder="Observação para a trilha de auditoria (opcional)"
        className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-[12.5px] text-ink placeholder:text-ink-3 outline-none focus:border-accent/50"
      />
      <div className="mt-2 grid grid-cols-2 gap-2">
        {ACTIONS.map(({ status, label, icon: Icon }) => (
          <Button
            key={status}
            size="sm"
            variant={status === "dismissed" ? "ghost" : opportunity.status === status ? "primary" : "secondary"}
            disabled={mutation.isPending || opportunity.status === status}
            onClick={() => mutation.mutate(status)}
          >
            <Icon className="size-3.5" /> {label}
          </Button>
        ))}
      </div>
      {mutation.error && (
        <p className="mt-2 text-[12px] text-[#f07171]">{mutation.error instanceof ApiError ? mutation.error.message : "Falha ao atualizar."}</p>
      )}
      <p className="mt-2 text-[11.5px] text-ink-3">Cada mudança de status é registrada na auditoria com analista, data e observação.</p>
    </div>
  );
}

export default function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const role = useRole();
  const { data: o, error } = useQuery({ queryKey: ["opportunity", id, role], queryFn: () => api.opportunity(id) });

  if (error) return <ErrorState error={error} className="mt-24" />;
  if (!o) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }
  const meta = OPPORTUNITY_META[o.type];
  const band = BAND_META[o.customer.health_band];

  return (
    <div className="animate-fade-in">
      <Link href="/oportunidades" className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-ink-3 hover:text-ink">
        <ArrowLeft className="size-3.5" /> Oportunidades
      </Link>

      {/* Header */}
      <Card className="relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -top-24 -right-20 size-72 rounded-full bg-accent/[0.08] blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <OpportunityTag type={o.type} />
            <div className="mt-3 text-[12px] font-semibold tracking-[0.16em] text-accent-soft uppercase">{o.title}</div>
            <h1 className="mt-1 max-w-3xl text-[22px] leading-snug font-semibold tracking-tight text-ink">{o.summary}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3">
              <PriorityBadge priority={o.priority} />
              <StatusBadge status={o.status} />
              <span>
                {o.opportunity_id} · regra {o.rule_id} · motor v{o.engine_version} · detectada em {dateTimeBR(o.created_at)}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-5 rounded-xl border border-accent/25 bg-accent/[0.04] px-5 py-4">
            <ScoreRing value={o.score} color="var(--color-accent)" size={84} stroke={7} label={`Opportunity Score ${o.score}`} />
            <div>
              <div className="text-[12px] text-ink-3">Opportunity Score</div>
              <div className="text-[13px] text-ink-2">
                <span className="text-[22px] font-semibold text-ink">{o.score}</span> / 100
              </div>
              <div className="mt-2 text-[12px] text-ink-3">{meta.valueLabel}</div>
              <div className="text-[20px] font-semibold text-ink">{brl(o.estimated_value)}</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Metrics */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {o.metrics.map((m) => (
          <Card key={m.key} className="p-4">
            <div className="text-[12.5px] text-ink-2">{m.label}</div>
            <div className="mt-1.5 text-[22px] font-semibold tracking-tight text-ink">{formatMetric(m)}</div>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-8">
          {/* Type-specific visualization */}
          <Card className="p-5">
            <OpportunityViz opportunity={o} />
          </Card>

          {/* Evidence + score composition */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Evidências" subtitle="Fatos que dispararam a regra, extraídos dos dados do cliente" />
              <ul className="space-y-2.5 px-5 pb-5">
                {o.evidence.map((e) => (
                  <li key={e.text} className="flex gap-2.5 text-[13px] leading-snug">
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
              <CardHeader title={`Composição do score · ${o.score}/100`} subtitle="Cada fator vale no máximo o peso indicado" />
              <div className="space-y-3 px-5 pb-5">
                {o.score_breakdown.map((f) => (
                  <div key={f.key}>
                    <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
                      <span className="font-medium text-ink">{f.label}</span>
                      <span className="tnum text-ink-3">
                        <span className="font-semibold text-ink">{num(f.points, 1)}</span> / {f.max_points}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-blue/15">
                      <div className="h-full rounded-full bg-blue" style={{ width: `${(f.points / f.max_points) * 100}%` }} />
                    </div>
                    <div className="mt-1 text-[12px] text-ink-3">{f.detail}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* AI explanation */}
          <div className="rounded-xl border border-violet/20 bg-gradient-to-b from-violet/[0.07] to-transparent p-5">
            <div className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
              <WandSparkles className="size-4 text-violet" /> Por que esta oportunidade foi detectada
            </div>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink">{o.explanation}</p>
          </div>
        </div>

        <div className="space-y-4 xl:col-span-4">
          <Card>
            <CardHeader title="Ação recomendada ao analista" />
            <div className="px-5 pb-5">
              <p className="text-[13px] leading-relaxed text-ink">{o.recommended_action}</p>
              <div className="mt-4 flex gap-2 rounded-lg border border-line bg-white/[0.02] p-3 text-[12px] leading-snug text-ink-3">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" /> {o.guardrail}
              </div>
            </div>
          </Card>
          <Card>
            <CardHeader title="Workflow" subtitle="Registre o andamento da abordagem" />
            <div className="px-5 pb-5">
              <Workflow opportunity={o} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Cliente" />
            <div className="px-5 pb-5">
              <Link href={`/clientes/${o.customer.customer_id}`} className="group block rounded-lg border border-line p-3.5 transition-colors hover:border-white/15">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-semibold text-ink group-hover:text-accent-soft">{o.customer.name}</span>
                  <ArrowRight className="size-4 text-ink-3" />
                </div>
                <div className="text-[12px] text-ink-3">
                  {o.customer.customer_id} · {o.customer.segment} · {o.customer.age_range} anos · {o.customer.occupation_category}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                  <div>
                    <div className="text-ink-3">Renda mensal</div>
                    <div className="font-medium text-ink">{brl(o.customer.monthly_income)}</div>
                  </div>
                  <div>
                    <div className="text-ink-3">Patrimônio</div>
                    <div className="font-medium text-ink">{brl(o.customer.total_assets)}</div>
                  </div>
                  <div>
                    <div className="text-ink-3">Financial Health</div>
                    <div className={cn("font-medium", band.text)}>
                      {o.customer.health_score} · {band.label}
                    </div>
                  </div>
                  <div>
                    <div className="text-ink-3">Instituições</div>
                    <div className="font-medium text-ink">{o.customer.institutions_count}</div>
                  </div>
                </div>
                <div className="mt-3 text-[12px] font-medium text-accent-soft">Abrir Customer 360 →</div>
              </Link>
            </div>
          </Card>
          {o.related.length > 0 && (
            <Card>
              <CardHeader title="Outras oportunidades do cliente" />
              <ul className="px-3 pb-3">
                {o.related.map((r) => (
                  <li key={r.opportunity_id}>
                    <Link href={`/oportunidades/${r.opportunity_id}`} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-white/[0.03]">
                      <OpportunityTag type={r.type} />
                      <span className="flex items-center gap-3 text-[12.5px]">
                        <span className="tnum text-ink-2">{brl(r.estimated_value)}</span>
                        <span className="tnum w-7 text-right font-semibold text-ink">{r.score}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
