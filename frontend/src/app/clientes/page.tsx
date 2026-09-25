"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Activity, ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Radar, Search, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { InstitutionStack } from "@/components/ui/InstitutionAvatar";
import { LazyScoreExplain } from "@/components/ui/LazyScoreExplain";
import { Meter } from "@/components/ui/Meter";
import { OpportunityTag } from "@/components/ui/OpportunityTag";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { api } from "@/lib/api";
import { brl, num } from "@/lib/format";
import { useInstitutions, useMeta } from "@/lib/hooks";
import { BAND_META, DEBT_LEVEL_META, OPPORTUNITY_META, OPPORTUNITY_ORDER, SEGMENTS } from "@/lib/labels";
import { useRole } from "@/lib/role";
import type { CustomerListItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const RANGES = {
  assets: [
    { value: "0-10000", label: "Até R$ 10 mil" },
    { value: "10000-50000", label: "R$ 10 mil – 50 mil" },
    { value: "50000-200000", label: "R$ 50 mil – 200 mil" },
    { value: "200000-", label: "Acima de R$ 200 mil" },
  ],
  income: [
    { value: "0-5000", label: "Até R$ 5 mil" },
    { value: "5000-10000", label: "R$ 5 mil – 10 mil" },
    { value: "10000-25000", label: "R$ 10 mil – 25 mil" },
    { value: "25000-", label: "Acima de R$ 25 mil" },
  ],
  institutions: [
    { value: "1-2", label: "1 a 2 bancos" },
    { value: "3-4", label: "3 a 4 bancos" },
    { value: "5-", label: "5 ou mais bancos" },
  ],
};

const SORTS: { key: string; label: string }[] = [
  { key: "opportunity_score", label: "Opportunity Score" },
  { key: "opportunity_value", label: "Valor em oportunidades" },
  { key: "health_score", label: "Financial Health" },
  { key: "total_assets", label: "Patrimônio" },
  { key: "total_debt", label: "Dívida" },
  { key: "monthly_income", label: "Renda" },
  { key: "institutions_count", label: "Instituições" },
  { key: "name", label: "Nome" },
];

const FILTER_KEYS = [
  "search", "min_score", "opportunity_type", "institution_id", "min_assets", "max_assets", "min_income", "max_income",
  "debt_level", "min_institutions", "max_institutions", "health_band", "segment", "segment_id", "signal", "insight", "anomaly",
];

export default function CustomersPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[70vh] rounded-xl" />}>
      <CustomersView />
    </Suspense>
  );
}

function CustomersView() {
  const role = useRole();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const institutions = useInstitutions();
  const { data: meta } = useMeta();
  const [searchText, setSearchText] = useState(params.get("search") ?? "");

  const update = (changes: Record<string, string | string[] | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      next.delete(key);
      if (Array.isArray(value)) value.forEach((v) => next.append(key, v));
      else if (value) next.set(key, value);
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

  const range = (minKey: string, maxKey: string) => {
    const min = params.get(minKey);
    const max = params.get(maxKey);
    return min || max ? `${min ?? "0"}-${max ?? ""}` : "";
  };
  const setRange = (minKey: string, maxKey: string, value: string) => {
    const [min, max] = value ? value.split("-") : [null, null];
    update({ [minKey]: min && min !== "0" ? min : value ? "0" : null, [maxKey]: max || null });
  };

  const sort = params.get("sort") ?? "opportunity_score";
  const order = params.get("order") ?? "desc";
  const page = Number(params.get("page") ?? 1);

  const apiParams = useMemo(() => {
    const out: Record<string, string | string[]> = { sort, order, page: String(page), page_size: "25" };
    for (const key of FILTER_KEYS) {
      const values = params.getAll(key);
      if (values.length > 1) out[key] = values;
      else if (values.length === 1 && values[0] !== "") out[key] = values[0];
    }
    return out;
  }, [params, sort, order, page]);

  const query = useQuery({
    queryKey: ["customers", role, apiParams],
    queryFn: () => api.customers(apiParams),
    placeholderData: keepPreviousData,
  });
  const insights = useQuery({ queryKey: ["insights", role], queryFn: api.insights, enabled: !!params.get("insight") });
  const activeInsight = insights.data?.find((i) => i.insight_id === params.get("insight"));
  const signalLabel = meta?.signal_types.find((s) => s.key === params.get("signal"))?.label;
  const hasFilters = FILTER_KEYS.some((key) => params.get(key));

  const toggleSort = (key: string) => {
    if (sort === key) update({ order: order === "desc" ? "asc" : "desc" });
    else update({ sort: key, order: key === "name" ? "asc" : "desc" });
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Carteira"
        title="Clientes"
        description="Pesquise e filtre a carteira. Todos os indicadores vêm dos dados Open Finance consolidados por cliente."
      />

      {/* One filter row above everything it scopes */}
      <Card className="mb-4 p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[minmax(220px,1.6fr)_repeat(5,minmax(0,1fr))]">
          <label className="relative sm:col-span-2 lg:col-span-2 xl:col-span-1">
            <span className="sr-only">Buscar por nome ou ID</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Nome ou ID do cliente"
              className="h-9 w-full rounded-lg border border-line bg-surface pr-3 pl-9 text-[13px] text-ink placeholder:text-ink-3 outline-none focus:border-accent/50"
            />
          </label>
          <FilterSelect
            label="Opportunity Score"
            value={params.get("min_score") ?? ""}
            onChange={(v) => update({ min_score: v || null })}
            options={[
              { value: "80", label: "Score ≥ 80 (prioritários)" },
              { value: "60", label: "Score ≥ 60" },
              { value: "45", label: "Com oportunidade" },
            ]}
          />
          <FilterSelect
            label="Tipo de oportunidade"
            value={params.get("opportunity_type") ?? ""}
            onChange={(v) => update({ opportunity_type: v || null })}
            options={OPPORTUNITY_ORDER.map((t) => ({ value: t, label: OPPORTUNITY_META[t].label }))}
          />
          <FilterSelect
            label="Instituição"
            value={params.get("institution_id") ?? ""}
            onChange={(v) => update({ institution_id: v || null })}
            options={(meta?.institutions ?? []).map((i) => ({ value: i.institution_id, label: i.name }))}
          />
          <FilterSelect label="Patrimônio" value={range("min_assets", "max_assets")} onChange={(v) => setRange("min_assets", "max_assets", v)} options={RANGES.assets} />
          <FilterSelect label="Renda" value={range("min_income", "max_income")} onChange={(v) => setRange("min_income", "max_income", v)} options={RANGES.income} />
          <FilterSelect
            label="Endividamento"
            value={params.get("debt_level") ?? ""}
            onChange={(v) => update({ debt_level: v || null })}
            options={[
              { value: "low", label: "Endividamento baixo" },
              { value: "moderate", label: "Endividamento moderado" },
              { value: "high", label: "Endividamento alto" },
            ]}
          />
          <FilterSelect
            label="Quantidade de bancos"
            value={range("min_institutions", "max_institutions")}
            onChange={(v) => setRange("min_institutions", "max_institutions", v)}
            options={RANGES.institutions}
          />
          <FilterSelect
            label="Financial Health"
            value={params.get("health_band") ?? ""}
            onChange={(v) => update({ health_band: v || null })}
            options={(["excellent", "healthy", "attention", "critical"] as const).map((b) => ({ value: b, label: `Saúde ${BAND_META[b].label.toLowerCase()}` }))}
          />
          <FilterSelect
            label="Segmento"
            value={params.get("segment") ?? ""}
            onChange={(v) => update({ segment: v || null })}
            options={SEGMENTS.map((s) => ({ value: s, label: s }))}
          />
          <FilterSelect
            label="Segmento comportamental"
            value={params.get("segment_id") ?? ""}
            onChange={(v) => update({ segment_id: v || null })}
            options={(meta?.segments ?? []).map((s) => ({ value: String(s.segment_id), label: s.name }))}
          />
        </div>

        {(activeInsight || signalLabel || params.get("anomaly") || hasFilters) && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
            {activeInsight && (
              <Badge className="bg-accent/10 text-accent-soft ring-accent/25">
                <Sparkles className="size-3" /> Insight: {activeInsight.title}
                <button aria-label="Remover filtro de insight" onClick={() => update({ insight: null })} className="ml-1 hover:text-ink">
                  <X className="size-3" />
                </button>
              </Badge>
            )}
            {signalLabel && (
              <Badge className="bg-warning/10 text-warning ring-warning/25">
                <Activity className="size-3" /> Sinal: {signalLabel}
                <button aria-label="Remover filtro de sinal" onClick={() => update({ signal: null })} className="ml-1 hover:text-ink">
                  <X className="size-3" />
                </button>
              </Badge>
            )}
            {params.get("anomaly") && (
              <Badge className="bg-violet/12 text-[#c9c3f7] ring-violet/25">
                <Radar className="size-3" /> Comportamento atípico
                <button aria-label="Remover filtro de anomalia" onClick={() => update({ anomaly: null })} className="ml-1 hover:text-ink">
                  <X className="size-3" />
                </button>
              </Badge>
            )}
            {hasFilters && (
              <button
                onClick={() => {
                  setSearchText("");
                  router.replace(pathname, { scroll: false });
                }}
                className="ml-auto text-[12.5px] font-medium text-ink-3 hover:text-ink"
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}
      </Card>

      <Card className={cn("transition-opacity", query.isFetching && query.isPlaceholderData && "opacity-60")}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div className="text-[13px] text-ink-2">
            {query.data ? (
              <>
                <span className="font-semibold text-ink">{num(query.data.total)}</span> clientes encontrados
              </>
            ) : (
              "Carregando…"
            )}
          </div>
          <div className="flex items-center gap-2 text-[12.5px] text-ink-3">
            Ordenar por
            <FilterSelect
              label="Ordenação"
              value={sort}
              onChange={(v) => update({ sort: v || "opportunity_score" })}
              options={SORTS.map((s) => ({ value: s.key, label: s.label }))}
              className="w-[210px]"
            />
            <button
              onClick={() => update({ order: order === "desc" ? "asc" : "desc" })}
              className="grid size-9 place-items-center rounded-lg border border-line text-ink-2 hover:border-line-strong hover:text-ink"
              aria-label={order === "desc" ? "Ordem decrescente" : "Ordem crescente"}
            >
              {order === "desc" ? <ArrowDown className="size-4" /> : <ArrowUp className="size-4" />}
            </button>
          </div>
        </div>

        {query.error ? (
          <ErrorState error={query.error} />
        ) : !query.data ? (
          <div className="space-y-2 px-5 pb-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : query.data.items.length === 0 ? (
          <EmptyState title="Nenhum cliente com esses filtros" description="Ajuste ou limpe os filtros para ampliar a busca." />
        ) : (
          <CustomersTable rows={query.data.items} institutions={institutions} sort={sort} order={order} onSort={toggleSort} />
        )}

        {query.data && query.data.pages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-[12.5px] text-ink-3">
            <span>
              Página <span className="text-ink">{query.data.page}</span> de {num(query.data.pages)}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => update({ page: String(page - 1) })}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-line px-3 text-ink-2 hover:border-line-strong hover:text-ink disabled:opacity-40"
              >
                <ChevronLeft className="size-4" /> Anterior
              </button>
              <button
                disabled={page >= query.data.pages}
                onClick={() => update({ page: String(page + 1) })}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-line px-3 text-ink-2 hover:border-line-strong hover:text-ink disabled:opacity-40"
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

function SortHeader({
  label,
  column,
  sort,
  order,
  onSort,
  align = "left",
}: {
  label: string;
  column: string;
  sort: string;
  order: string;
  onSort: (key: string) => void;
  align?: "left" | "right";
}) {
  const active = sort === column;
  return (
    <th className={cn("px-3 py-2.5 font-medium", align === "right" && "text-right")} aria-sort={active ? (order === "desc" ? "descending" : "ascending") : "none"}>
      <button onClick={() => onSort(column)} className={cn("inline-flex items-center gap-1 uppercase hover:text-ink-2", active && "text-ink-2")}>
        {label}
        {active && (order === "desc" ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
      </button>
    </th>
  );
}

function CustomersTable({
  rows,
  institutions,
  sort,
  order,
  onSort,
}: {
  rows: CustomerListItem[];
  institutions: ReturnType<typeof useInstitutions>;
  sort: string;
  order: string;
  onSort: (key: string) => void;
}) {
  const router = useRouter();
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-left text-[13px]">
        <thead>
          <tr className="border-y border-line text-[11.5px] tracking-wide text-ink-3">
            <SortHeader label="Cliente" column="name" sort={sort} order={order} onSort={onSort} />
            <SortHeader label="Financial Health" column="health_score" sort={sort} order={order} onSort={onSort} />
            <SortHeader label="Opp. Score" column="opportunity_score" sort={sort} order={order} onSort={onSort} />
            <th className="px-3 py-2.5 font-medium uppercase">Top opportunity</th>
            <SortHeader label="Patrimônio" column="total_assets" sort={sort} order={order} onSort={onSort} align="right" />
            <SortHeader label="Dívida" column="total_debt" sort={sort} order={order} onSort={onSort} align="right" />
            <SortHeader label="Instituições" column="institutions_count" sort={sort} order={order} onSort={onSort} />
            <th className="px-3 py-2.5 font-medium uppercase">Sinais</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const band = BAND_META[row.health_band];
            return (
              <tr
                key={row.customer_id}
                onClick={() => router.push(`/clientes/${row.customer_id}`)}
                className="cursor-pointer border-b border-line/70 transition-colors last:border-0 hover:bg-white/[0.025]"
              >
                <td className="px-5 py-2.5">
                  <Link
                    href={`/clientes/${row.customer_id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium whitespace-nowrap text-ink hover:text-accent-soft"
                  >
                    {row.name}
                  </Link>
                  <div className="text-[12px] whitespace-nowrap text-ink-3">
                    {row.customer_id} · {row.segment} · {row.age_range}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="tnum w-7 font-semibold text-ink">{row.health_score}</span>
                    <div className="w-16">
                      <Meter value={row.health_score / 100} color={band.color} />
                    </div>
                    <span className={cn("text-[12px]", band.text)}>{band.label}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <LazyScoreExplain customerId={row.customer_id} score={row.opportunity_score} type={row.top_opportunity_type} />
                </td>
                <td className="px-3 py-2.5">
                  {row.top_opportunity_type ? (
                    <span className="flex items-center gap-2">
                      <OpportunityTag type={row.top_opportunity_type} short />
                      {row.opportunities_count > 1 && <span className="text-[11.5px] text-ink-3">+{row.opportunities_count - 1}</span>}
                    </span>
                  ) : (
                    <span className="text-ink-3">—</span>
                  )}
                </td>
                <td className="tnum px-3 py-2.5 text-right text-ink">{brl(row.total_assets)}</td>
                <td className="px-3 py-2.5 text-right">
                  <div className="tnum text-ink">{brl(row.total_debt)}</div>
                  <div className={cn("text-[11.5px]", DEBT_LEVEL_META[row.debt_level].className)}>{DEBT_LEVEL_META[row.debt_level].label}</div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <InstitutionStack institutions={row.institutions.map((id) => institutions[id]).filter(Boolean)} />
                    <span className="text-[12px] text-ink-3">{row.institutions_count}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    {row.signals_count > 0 && (
                      <Badge className="bg-warning/10 text-warning ring-warning/20" title="Mudanças de comportamento no último trimestre">
                        <Activity className="size-3" /> {row.signals_count}
                      </Badge>
                    )}
                    {row.is_anomaly && (
                      <Badge className="bg-violet/12 text-[#c9c3f7] ring-violet/25" title="Comportamento atípico (Isolation Forest)">
                        <Radar className="size-3" />
                      </Badge>
                    )}
                    {row.signals_count === 0 && !row.is_anomaly && <span className="text-ink-3">—</span>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
