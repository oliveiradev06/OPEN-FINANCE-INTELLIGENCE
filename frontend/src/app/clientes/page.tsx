"use client";

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Calculator,
  ChevronsUpDown,
  Download,
  Ellipsis,
  ExternalLink,
  Radar,
  SlidersHorizontal,
  Sparkles,
  Star,
  Target,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ConsentPill } from "@/components/customer/ConsentPill";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dropdown, MenuDivider, MenuItem } from "@/components/ui/Dropdown";
import { FilterSelect, SearchInput } from "@/components/ui/FilterSelect";
import { LazyScoreExplain } from "@/components/ui/LazyScoreExplain";
import { OpportunityTiles } from "@/components/ui/OpportunityTag";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { Tabs } from "@/components/ui/Tabs";
import { ApiError, api } from "@/lib/api";
import { addFavorites, toggleFavorite, useFavorites } from "@/lib/favorites";
import { useCan, useMeta } from "@/lib/hooks";
import { BAND_META, OPPORTUNITY_META, OPPORTUNITY_ORDER, SEGMENTS } from "@/lib/labels";
import { useRole } from "@/lib/role";
import type { CustomerListItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

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
  score: [
    { value: "80-100", label: "Score 80 ou mais" },
    { value: "60-79", label: "Score 60 a 79" },
    { value: "45-59", label: "Score 45 a 59" },
    { value: "0-0", label: "Sem oportunidade" },
  ],
};

const SORTS = [
  { value: "opportunity_score", label: "Opportunity Score" },
  { value: "opportunity_value", label: "Valor em oportunidades" },
  { value: "health_score", label: "Saúde financeira" },
  { value: "total_assets", label: "Patrimônio" },
  { value: "total_debt", label: "Dívida" },
  { value: "monthly_income", label: "Renda" },
  { value: "institutions_count", label: "Instituições" },
  { value: "name", label: "Nome" },
];

// Filters kept in the URL (shareable, back-button friendly). "More filters" are the advanced ones.
const FILTER_KEYS = [
  "search", "min_score", "max_score", "opportunity_type", "institution_id", "min_assets", "max_assets", "min_income", "max_income",
  "debt_level", "min_institutions", "max_institutions", "health_band", "segment", "segment_id", "signal", "insight", "anomaly",
];
const ADVANCED_KEYS = ["opportunity_type", "institution_id", "min_assets", "max_assets", "min_income", "max_income", "debt_level", "min_institutions", "max_institutions", "health_band", "segment_id"];

type Tab = "todos" | "oportunidades" | "alertas" | "novos" | "favoritos";

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
  const { data: meta } = useMeta();
  const favorites = useFavorites();
  const canExport = useCan("customers:read");
  const [searchText, setSearchText] = useState(params.get("search") ?? "");
  const [showMore, setShowMore] = useState(() => ADVANCED_KEYS.some((k) => params.get(k)));
  const [selected, setSelected] = useState<string[]>([]);

  const update = (changes: Record<string, string | string[] | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      next.delete(key);
      if (Array.isArray(value)) value.forEach((v) => next.append(key, v));
      else if (value) next.set(key, value);
    }
    if (!("page" in changes)) next.delete("page");
    setSelected([]);
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

  const tab = (params.get("tab") as Tab) ?? "todos";
  const sort = params.get("sort") ?? "opportunity_score";
  const order = params.get("order") ?? "desc";
  const page = Number(params.get("page") ?? 1);

  const filters = useMemo(() => {
    const out: Record<string, string | string[]> = {};
    for (const key of FILTER_KEYS) {
      const values = params.getAll(key);
      if (values.length > 1) out[key] = values;
      else if (values.length === 1 && values[0] !== "") out[key] = values[0];
    }
    return out;
  }, [params]);

  const tabFilter = useMemo((): Record<string, string | string[]> => {
    if (tab === "oportunidades") return { has_opportunities: "true" };
    if (tab === "alertas") return { has_signals: "true" };
    if (tab === "novos") return { new_connections: "true" };
    if (tab === "favoritos") return { customer_id: favorites };
    return {};
  }, [tab, favorites]);

  const noFavorites = tab === "favoritos" && favorites.length === 0;
  const query = useQuery({
    queryKey: ["customers", role, filters, tabFilter, sort, order, page],
    queryFn: () => api.customers({ ...filters, ...tabFilter, sort, order, page: String(page), page_size: String(PAGE_SIZE) }),
    placeholderData: keepPreviousData,
    enabled: !noFavorites,
  });
  const counts = useQuery({
    queryKey: ["customer-tabs", role, filters],
    queryFn: () => api.customerTabCounts(filters),
    placeholderData: keepPreviousData,
  });
  const insights = useQuery({ queryKey: ["insights", role], queryFn: api.insights, enabled: !!params.get("insight") });
  const exportList = useMutation({ mutationFn: (extra: Record<string, string | string[]>) => api.downloadReport("clientes", extra) });

  const activeInsight = insights.data?.find((i) => i.insight_id === params.get("insight"));
  const signalLabel = meta?.signal_types.find((s) => s.key === params.get("signal"))?.label;
  const advancedCount = ADVANCED_KEYS.filter((k) => params.get(k)).length;
  const hasFilters = FILTER_KEYS.some((key) => params.get(key));
  const rows = noFavorites ? [] : (query.data?.items ?? []);
  const pageIds = rows.map((r) => r.customer_id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));

  const toggleSort = (key: string) => {
    if (sort === key) update({ order: order === "desc" ? "asc" : "desc" });
    else update({ sort: key, order: key === "name" ? "asc" : "desc" });
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Clientes"
        description="Gerencie e explore sua carteira com dados de Open Finance"
        actions={
          <Button variant="primary" onClick={() => exportList.mutate({ ...filters, ...tabFilter })} disabled={exportList.isPending || noFavorites || !canExport}>
            <Download className="size-4" /> {exportList.isPending ? "Exportando…" : "Exportar lista"}
          </Button>
        }
      />
      {exportList.error && (
        <p className="-mt-2 mb-3 text-[13px] text-critical">{exportList.error instanceof ApiError ? exportList.error.message : "Falha na exportação."}</p>
      )}

      <Card className="overflow-hidden">
        {/* Filter row */}
        <div className="grid gap-3 p-5 pb-4 md:grid-cols-2 xl:grid-cols-[minmax(260px,1.6fr)_repeat(2,minmax(0,1fr))_auto]">
          <SearchInput value={searchText} onChange={setSearchText} placeholder="Buscar por nome ou ID do cliente…" label="Buscar cliente" className="md:col-span-2 xl:col-span-1" />
          <FilterSelect label="Todos os segmentos" value={params.get("segment") ?? ""} onChange={(v) => update({ segment: v || null })} options={SEGMENTS.map((s) => ({ value: s, label: s }))} />
          <FilterSelect label="Todos os scores" value={range("min_score", "max_score")} onChange={(v) => setRange("min_score", "max_score", v)} options={RANGES.score} />
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            aria-expanded={showMore}
            className={cn(
              "inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-[13.5px] font-medium transition-colors",
              showMore || advancedCount ? "border-primary/40 bg-primary-soft text-primary-ink" : "border-line-strong bg-white text-ink hover:bg-surface-2",
            )}
          >
            <SlidersHorizontal className="size-4" /> Mais filtros
            {advancedCount > 0 && <span className="tnum grid size-5 place-items-center rounded-full bg-primary text-[11px] font-bold text-white">{advancedCount}</span>}
          </button>
        </div>

        {showMore && (
          <div className="grid gap-3 border-t border-line bg-surface-2 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 animate-fade-in">
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
              label="Saúde financeira"
              value={params.get("health_band") ?? ""}
              onChange={(v) => update({ health_band: v || null })}
              options={(["excellent", "healthy", "attention", "critical"] as const).map((b) => ({ value: b, label: `Saúde ${BAND_META[b].label.toLowerCase()}` }))}
            />
            <FilterSelect
              label="Segmento comportamental"
              value={params.get("segment_id") ?? ""}
              onChange={(v) => update({ segment_id: v || null })}
              options={(meta?.segments ?? []).map((s) => ({ value: String(s.segment_id), label: s.name }))}
            />
            <FilterSelect label="Ordenar por" prefix="Ordenar por:" value={sort} onChange={(v) => update({ sort: v || "opportunity_score" })} options={SORTS} />
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearchText("");
                  router.replace(tab === "todos" ? pathname : `${pathname}?tab=${tab}`, { scroll: false });
                }}
                className="h-10 rounded-lg px-3 text-left text-[13px] font-semibold text-primary-ink hover:underline"
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}

        {(activeInsight || signalLabel || params.get("anomaly")) && (
          <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3">
            {activeInsight && (
              <Badge tone="green">
                <Sparkles className="size-3.5" /> Insight: {activeInsight.title}
                <button aria-label="Remover filtro de insight" onClick={() => update({ insight: null })} className="ml-1 hover:opacity-70">
                  <X className="size-3.5" />
                </button>
              </Badge>
            )}
            {signalLabel && (
              <Badge tone="amber">
                <Activity className="size-3.5" /> Sinal: {signalLabel}
                <button aria-label="Remover filtro de sinal" onClick={() => update({ signal: null })} className="ml-1 hover:opacity-70">
                  <X className="size-3.5" />
                </button>
              </Badge>
            )}
            {params.get("anomaly") && (
              <Badge tone="violet">
                <Radar className="size-3.5" /> Comportamento atípico
                <button aria-label="Remover filtro de anomalia" onClick={() => update({ anomaly: null })} className="ml-1 hover:opacity-70">
                  <X className="size-3.5" />
                </button>
              </Badge>
            )}
          </div>
        )}

        <Tabs
          className="px-3"
          value={tab}
          onChange={(value) => update({ tab: value === "todos" ? null : value })}
          items={[
            { value: "todos", label: "Todos", count: counts.data?.all },
            { value: "oportunidades", label: "Com oportunidades", count: counts.data?.with_opportunities },
            { value: "alertas", label: "Com alertas", count: counts.data?.with_signals, title: "Mudança de comportamento no último trimestre" },
            { value: "novos", label: "Novos", count: counts.data?.new_connections, title: "Primeiro consentimento Open Finance no mês de referência" },
            { value: "favoritos", label: "Favoritos", count: favorites.length || undefined },
          ]}
        />

        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-line bg-primary-soft/60 px-5 py-2.5 text-[13px] animate-fade-in">
            <span className="font-semibold text-ink">{selected.length} selecionado{selected.length > 1 ? "s" : ""}</span>
            <Button size="sm" variant="secondary" onClick={() => addFavorites(selected)}>
              <Star className="size-3.5" /> Adicionar aos favoritos
            </Button>
            <Button size="sm" variant="secondary" onClick={() => exportList.mutate({ customer_id: selected })}>
              <Download className="size-3.5" /> Exportar seleção
            </Button>
            <button type="button" onClick={() => setSelected([])} className="ml-auto text-[12.5px] font-semibold text-primary-ink hover:underline">
              Limpar seleção
            </button>
          </div>
        )}

        {noFavorites ? (
          <EmptyState icon={Star} title="Nenhum favorito ainda" description="Use o menu ⋯ de um cliente ou selecione vários na lista para acompanhá-los aqui." />
        ) : query.error ? (
          <ErrorState error={query.error} />
        ) : !query.data ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title="Nenhum cliente com esses filtros" description="Ajuste ou limpe os filtros para ampliar a busca." />
        ) : (
          <div className={cn("overflow-x-auto px-5 pt-3 transition-opacity", query.isFetching && query.isPlaceholderData && "opacity-60")}>
            <table className="w-full min-w-[980px] text-left text-[13.5px]">
              <thead>
                <tr className="bg-surface-2 text-[12.5px] text-ink-2">
                  <th className="w-11 rounded-l-lg py-2.5 pl-4">
                    <input
                      type="checkbox"
                      aria-label="Selecionar todos da página"
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? selected.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...selected, ...pageIds])))}
                      className="size-4 cursor-pointer accent-primary"
                    />
                  </th>
                  <SortHeader label="Cliente" column="name" sort={sort} order={order} onSort={toggleSort} />
                  <th className="px-3 py-2.5 font-medium">ID</th>
                  <th className="px-3 py-2.5 font-medium">Segmento</th>
                  <SortHeader label="Score" column="opportunity_score" sort={sort} order={order} onSort={toggleSort} />
                  <th className="px-3 py-2.5 font-medium">Oportunidades</th>
                  <th className="px-3 py-2.5 font-medium">Status Open Finance</th>
                  <th className="rounded-r-lg px-4 py-2.5 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <CustomerRow
                    key={row.customer_id}
                    row={row}
                    selected={selected.includes(row.customer_id)}
                    favorite={favorites.includes(row.customer_id)}
                    onSelect={() =>
                      setSelected((ids) => (ids.includes(row.customer_id) ? ids.filter((id) => id !== row.customer_id) : [...ids, row.customer_id]))
                    }
                    onOpen={() => router.push(`/clientes/${row.customer_id}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {query.data && !noFavorites && query.data.total > 0 && (
          <Pagination
            page={query.data.page}
            pages={query.data.pages}
            total={query.data.total}
            pageSize={PAGE_SIZE}
            noun="clientes"
            onChange={(p) => update({ page: String(p) })}
          />
        )}
      </Card>
    </div>
  );
}

function SortHeader({ label, column, sort, order, onSort }: { label: string; column: string; sort: string; order: string; onSort: (key: string) => void }) {
  const active = sort === column;
  const Icon = !active ? ChevronsUpDown : order === "desc" ? ArrowDown : ArrowUp;
  return (
    <th className="px-3 py-2.5 font-medium" aria-sort={active ? (order === "desc" ? "descending" : "ascending") : "none"}>
      <button type="button" onClick={() => onSort(column)} className={cn("inline-flex items-center gap-1 hover:text-ink", active && "text-ink")}>
        {label}
        <Icon className="size-3.5" />
      </button>
    </th>
  );
}

function CustomerRow({
  row,
  selected,
  favorite,
  onSelect,
  onOpen,
}: {
  row: CustomerListItem;
  selected: boolean;
  favorite: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  const stop = (event: React.MouseEvent) => event.stopPropagation();
  return (
    <tr onClick={onOpen} className={cn("cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-[#f9fbfe]", selected && "bg-primary-soft/40")}>
      <td className="py-2.5 pl-4" onClick={stop}>
        <input type="checkbox" aria-label={`Selecionar ${row.name}`} checked={selected} onChange={onSelect} className="size-4 cursor-pointer accent-primary" />
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-3">
          <Avatar name={row.name} />
          <Link href={`/clientes/${row.customer_id}`} onClick={stop} className="font-semibold whitespace-nowrap text-ink hover:text-primary-ink">
            {row.name}
          </Link>
          {favorite && <Star className="size-3.5 fill-[#f5b301] text-[#f5b301]" aria-label="Favorito" />}
          {row.is_anomaly && <Radar className="size-3.5 text-ai" aria-label="Comportamento atípico" />}
        </div>
      </td>
      <td className="tnum px-3 py-2.5 whitespace-nowrap text-ink-2">{row.customer_id}</td>
      <td className="px-3 py-2.5 whitespace-nowrap text-ink-2">{row.segment}</td>
      <td className="px-3 py-2.5" onClick={stop}>
        <LazyScoreExplain customerId={row.customer_id} score={row.opportunity_score} type={row.top_opportunity_type} />
      </td>
      <td className="px-3 py-2.5">
        <OpportunityTiles types={row.opportunity_types} />
      </td>
      <td className="px-3 py-2.5">
        <ConsentPill status={row.consent_status} />
      </td>
      <td className="px-4 py-2.5" onClick={stop}>
        <div className="flex items-center justify-end gap-2">
          <Link href={`/clientes/${row.customer_id}`} className={buttonClass("soft", "sm", "h-8 w-16")}>
            Ver
          </Link>
          <Dropdown
            label={`Ações para ${row.name}`}
            width={230}
            triggerClassName="grid size-8 place-items-center rounded-md text-ink-2 hover:bg-surface-3"
            trigger={<Ellipsis className="size-5" />}
          >
            {(close) => (
              <>
                <MenuItem icon={ExternalLink} href={`/clientes/${row.customer_id}`} onSelect={close}>
                  Abrir Customer 360
                </MenuItem>
                <MenuItem icon={Target} href={`/oportunidades?customer_id=${row.customer_id}`} onSelect={close}>
                  Ver oportunidades
                </MenuItem>
                <MenuItem icon={Calculator} href={`/simulador?customer=${row.customer_id}`} onSelect={close}>
                  Simular proposta
                </MenuItem>
                <MenuDivider />
                <MenuItem
                  icon={Star}
                  onSelect={() => {
                    toggleFavorite(row.customer_id);
                    close();
                  }}
                >
                  {favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                </MenuItem>
              </>
            )}
          </Dropdown>
        </div>
      </td>
    </tr>
  );
}
