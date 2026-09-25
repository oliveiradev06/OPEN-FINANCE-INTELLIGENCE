"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { OpportunityIcon, OpportunityTag, PriorityBadge, StatusBadge } from "@/components/ui/OpportunityTag";
import { PageHeader } from "@/components/ui/PageHeader";
import { ScoreExplain } from "@/components/ui/ScoreExplain";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { api } from "@/lib/api";
import { brl, brlCompact, dateBR, num } from "@/lib/format";
import { OPPORTUNITY_META, OPPORTUNITY_ORDER, STATUS_META } from "@/lib/labels";
import { useRole } from "@/lib/role";
import type { OpportunityStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function OpportunitiesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[70vh] rounded-xl" />}>
      <OpportunitiesView />
    </Suspense>
  );
}

function OpportunitiesView() {
  const role = useRole();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [searchText, setSearchText] = useState(params.get("search") ?? "");

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!("page" in changes)) next.delete("page");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  useEffect(() => {
    const id = setTimeout(() => {
      if ((params.get("search") ?? "") !== searchText.trim()) update({ search: searchText.trim() || null });
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  const type = params.get("type") ?? "";
  const status = params.get("status") ?? "";
  const priority = params.get("priority") ?? "";
  const sort = params.get("sort") ?? "score";
  const page = Number(params.get("page") ?? 1);

  const summary = useQuery({ queryKey: ["opportunities-summary", role], queryFn: api.opportunitiesSummary });
  const list = useQuery({
    queryKey: ["opportunities", role, type, status, priority, sort, page, params.get("search")],
    queryFn: () =>
      api.opportunities({ type: type || undefined, status: status || undefined, priority: priority || undefined, search: params.get("search") || undefined, sort, page, page_size: 20 }),
    placeholderData: keepPreviousData,
  });
  const byType = Object.fromEntries((summary.data?.by_type ?? []).map((t) => [t.type, t]));

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Opportunity Engine"
        title="Oportunidades"
        description="Detectadas automaticamente por regras explicáveis. Cada score é a soma de fatores medidos nos dados do cliente — e vem sempre com as evidências."
      />

      {/* Category cards double as the type filter */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-8">
        <button
          onClick={() => update({ type: null })}
          className={cn(
            "rounded-xl border p-3.5 text-left transition-colors",
            !type ? "border-accent/40 bg-accent/[0.06]" : "border-white/[0.06] bg-surface hover:border-white/12",
          )}
        >
          <div className="text-[12px] text-ink-2">Todas</div>
          <div className="mt-1 text-[20px] font-semibold text-ink">{summary.data ? num(summary.data.total) : "—"}</div>
          <div className="text-[11.5px] text-ink-3">{summary.data ? brlCompact(summary.data.total_value) : ""}</div>
        </button>
        {OPPORTUNITY_ORDER.map((t) => {
          const s = byType[t];
          return (
            <button
              key={t}
              onClick={() => update({ type: t === type ? null : t })}
              className={cn(
                "rounded-xl border p-3.5 text-left transition-colors",
                type === t ? "border-accent/40 bg-accent/[0.06]" : "border-white/[0.06] bg-surface hover:border-white/12",
              )}
            >
              <div className="flex items-center gap-1.5 text-[12px] text-ink-2">
                <OpportunityIcon type={t} className="size-3.5" />
                <span className="truncate">{OPPORTUNITY_META[t].label}</span>
              </div>
              <div className="mt-1 text-[20px] font-semibold text-ink">{s ? num(s.count) : "0"}</div>
              <div className="text-[11.5px] text-ink-3">{s ? `${brlCompact(s.value)} · ${num(s.high_priority)} alta` : ""}</div>
            </button>
          );
        })}
      </div>

      <Card className="mt-4">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <label className="relative w-full sm:w-64">
            <span className="sr-only">Buscar cliente</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Buscar cliente"
              className="h-9 w-full rounded-lg border border-line bg-surface pr-3 pl-9 text-[13px] text-ink placeholder:text-ink-3 outline-none focus:border-accent/50"
            />
          </label>
          <FilterSelect
            label="Status"
            value={status}
            onChange={(v) => update({ status: v || null })}
            options={(Object.keys(STATUS_META) as OpportunityStatus[]).map((s) => ({
              value: s,
              label: `${STATUS_META[s].label}${summary.data ? ` (${num(summary.data.by_status[s] ?? 0)})` : ""}`,
            }))}
            className="w-[200px]"
          />
          <FilterSelect
            label="Prioridade"
            value={priority}
            onChange={(v) => update({ priority: v || null })}
            options={[
              { value: "high", label: "Prioridade alta (≥ 80)" },
              { value: "medium", label: "Prioridade média (60–79)" },
              { value: "low", label: "Prioridade baixa (< 60)" },
            ]}
            className="w-[210px]"
          />
          <div className="ml-auto flex items-center gap-2 text-[12.5px] text-ink-3">
            Ordenar
            <FilterSelect
              label="Ordenação"
              value={sort}
              onChange={(v) => update({ sort: v || "score" })}
              options={[
                { value: "score", label: "Maior score" },
                { value: "estimated_value", label: "Maior valor" },
                { value: "created_at", label: "Mais recentes" },
              ]}
              className="w-[160px]"
            />
          </div>
        </div>

        {list.error ? (
          <ErrorState error={list.error} />
        ) : !list.data ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : list.data.items.length === 0 ? (
          <EmptyState title="Nenhuma oportunidade com esses filtros" />
        ) : (
          <div className={cn("overflow-x-auto transition-opacity", list.isFetching && list.isPlaceholderData && "opacity-60")}>
            <table className="w-full min-w-[980px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line text-[11.5px] tracking-wide text-ink-3 uppercase">
                  <th className="px-5 py-2.5 font-medium">Score</th>
                  <th className="px-3 py-2.5 font-medium">Oportunidade</th>
                  <th className="px-3 py-2.5 font-medium">Cliente</th>
                  <th className="px-3 py-2.5 text-right font-medium">Valor</th>
                  <th className="px-3 py-2.5 font-medium">Evidência principal</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((o) => (
                  <tr
                    key={o.opportunity_id}
                    onClick={() => router.push(`/oportunidades/${o.opportunity_id}`)}
                    className="cursor-pointer border-b border-line/70 align-top transition-colors last:border-0 hover:bg-white/[0.025]"
                  >
                    <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                      <ScoreExplain score={o.score} title={o.type_label} reasons={o.top_evidence} />
                      <div className="mt-1">
                        <PriorityBadge priority={o.priority} />
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <OpportunityTag type={o.type} />
                      <Link
                        href={`/oportunidades/${o.opportunity_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 block font-medium text-ink hover:text-accent-soft"
                      >
                        {o.title}
                      </Link>
                      <div className="text-[11.5px] text-ink-3">
                        {o.opportunity_id} · {dateBR(o.created_at)}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium whitespace-nowrap text-ink">{o.customer_name}</div>
                      <div className="text-[12px] whitespace-nowrap text-ink-3">
                        {o.segment} · {o.institutions_count} instituições
                      </div>
                    </td>
                    <td className="tnum px-3 py-3 text-right font-semibold whitespace-nowrap text-ink">{brl(o.estimated_value)}</td>
                    <td className="max-w-[360px] px-3 py-3 text-[12.5px] leading-snug text-ink-2">{o.top_evidence[0]}</td>
                    <td className="px-3 py-3">
                      <StatusBadge status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {list.data && list.data.pages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-[12.5px] text-ink-3">
            <span>
              {num(list.data.total)} oportunidades · página <span className="text-ink">{list.data.page}</span> de {num(list.data.pages)}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => update({ page: String(page - 1) })}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-line px-3 text-ink-2 hover:text-ink disabled:opacity-40"
              >
                <ChevronLeft className="size-4" /> Anterior
              </button>
              <button
                disabled={page >= list.data.pages}
                onClick={() => update({ page: String(page + 1) })}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-line px-3 text-ink-2 hover:text-ink disabled:opacity-40"
              >
                Próxima <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
