"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  Calculator,
  ChevronsUpDown,
  Download,
  Ellipsis,
  ExternalLink,
  Handshake,
  LoaderCircle,
  PhoneCall,
  Search,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dropdown, MenuDivider, MenuItem, MenuLabel } from "@/components/ui/Dropdown";
import { FilterSelect, SearchInput } from "@/components/ui/FilterSelect";
import { OpportunityPill, PriorityBadge, StatusBadge } from "@/components/ui/OpportunityTag";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { ScoreExplain } from "@/components/ui/ScoreExplain";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { Tabs } from "@/components/ui/Tabs";
import { ApiError, api } from "@/lib/api";
import { brl, shortId } from "@/lib/format";
import { useCan } from "@/lib/hooks";
import { OPPORTUNITY_META, OPPORTUNITY_ORDER, STATUS_META } from "@/lib/labels";
import { useRole } from "@/lib/role";
import type { OpportunityListItem, OpportunityStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

const QUICK_STATUS: { status: OpportunityStatus; label: string; icon: typeof Search }[] = [
  { status: "in_review", label: "Iniciar análise", icon: Search },
  { status: "contacted", label: "Cliente contatado", icon: PhoneCall },
  { status: "converted", label: "Marcar como convertida", icon: Handshake },
  { status: "dismissed", label: "Descartar", icon: XCircle },
];

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
  const client = useQueryClient();
  const canUpdate = useCan("opportunities:update");
  const canExport = useCan("customers:read");
  const [searchText, setSearchText] = useState(params.get("search") ?? "");
  const [selected, setSelected] = useState<string[]>([]);

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
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

  const type = params.get("type") ?? "";
  const status = params.get("status") ?? "";
  const priority = params.get("priority") ?? "";
  const customerId = params.get("customer_id") ?? "";
  const sort = params.get("sort") ?? "score";
  const order = params.get("order") ?? "desc";
  const page = Number(params.get("page") ?? 1);

  const summary = useQuery({ queryKey: ["opportunities-summary", role], queryFn: api.opportunitiesSummary });
  const list = useQuery({
    queryKey: ["opportunities", role, type, status, priority, customerId, sort, order, page, params.get("search")],
    queryFn: () =>
      api.opportunities({
        type: type || undefined,
        status: status || undefined,
        priority: priority || undefined,
        customer_id: customerId || undefined,
        search: params.get("search") || undefined,
        sort,
        order,
        page,
        page_size: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const refresh = () => {
    client.invalidateQueries({ queryKey: ["opportunities"] });
    client.invalidateQueries({ queryKey: ["opportunities-summary"] });
    client.invalidateQueries({ queryKey: ["customer"] });
    client.invalidateQueries({ queryKey: ["opportunity"] });
  };
  const changeStatus = useMutation({
    mutationFn: async ({ ids, to }: { ids: string[]; to: OpportunityStatus }) => {
      for (const id of ids) await api.updateOpportunity(id, to, ids.length > 1 ? "Alteração em lote na lista de oportunidades" : undefined);
    },
    onSuccess: () => {
      setSelected([]);
      refresh();
    },
  });
  const exportList = useMutation({
    mutationFn: () => api.downloadReport("oportunidades", { type: type || undefined, priority: priority || undefined, status: status || undefined }),
  });

  const byType = Object.fromEntries((summary.data?.by_type ?? []).map((t) => [t.type, t]));
  const rows = list.data?.items ?? [];
  const pageIds = rows.map((r) => r.opportunity_id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));
  const customerName = customerId ? rows[0]?.customer_name : undefined;

  const toggleSort = (key: string) => {
    if (sort === key) update({ order: order === "desc" ? "asc" : "desc" });
    else update({ sort: key, order: "desc" });
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Oportunidades"
        description="Identifique e ative novas oportunidades com base nos dados de Open Finance"
        actions={
          <Button variant="primary" onClick={() => exportList.mutate()} disabled={exportList.isPending || !canExport}>
            <Download className="size-4" /> {exportList.isPending ? "Exportando…" : "Exportar lista"}
          </Button>
        }
      />
      {(exportList.error || changeStatus.error) && (
        <p className="-mt-2 mb-3 text-[13px] text-critical">
          {[exportList.error, changeStatus.error].map((e) => (e instanceof ApiError ? e.message : e ? "Falha na operação." : "")).join(" ")}
        </p>
      )}

      <Card className="overflow-hidden">
        <div className="grid gap-3 p-5 pb-4 md:grid-cols-2 xl:grid-cols-[minmax(260px,1.6fr)_repeat(3,minmax(0,1fr))]">
          <SearchInput value={searchText} onChange={setSearchText} placeholder="Buscar por cliente ou ID…" label="Buscar oportunidade" className="md:col-span-2 xl:col-span-1" />
          <FilterSelect
            label="Todas as prioridades"
            value={priority}
            onChange={(v) => update({ priority: v || null })}
            options={[
              { value: "high", label: "Prioridade alta (80+)" },
              { value: "medium", label: "Prioridade média (60–79)" },
              { value: "low", label: "Prioridade baixa (< 60)" },
            ]}
          />
          <FilterSelect
            label="Todos os status"
            value={status}
            onChange={(v) => update({ status: v || null })}
            options={(Object.keys(STATUS_META) as OpportunityStatus[]).map((s) => ({
              value: s,
              label: `${STATUS_META[s].label}${summary.data ? ` (${(summary.data.by_status[s] ?? 0).toLocaleString("pt-BR")})` : ""}`,
            }))}
          />
          <FilterSelect
            label="Ordenar por"
            prefix="Ordenar por:"
            value={sort}
            onChange={(v) => update({ sort: v || "score" })}
            options={[
              { value: "score", label: "Score" },
              { value: "estimated_value", label: "Valor potencial" },
              { value: "created_at", label: "Mais recentes" },
            ]}
          />
        </div>

        {customerId && (
          <div className="flex items-center gap-2 border-t border-line px-5 py-3">
            <Badge tone="blue">
              <UserRound className="size-3.5" /> Cliente: {customerName ?? customerId}
              <button aria-label="Remover filtro de cliente" onClick={() => update({ customer_id: null })} className="ml-1 hover:opacity-70">
                <X className="size-3.5" />
              </button>
            </Badge>
          </div>
        )}

        <Tabs
          className="px-3"
          value={type || "all"}
          onChange={(value) => update({ type: value === "all" ? null : value })}
          items={[
            { value: "all", label: "Todas", count: summary.data?.total },
            ...OPPORTUNITY_ORDER.map((t) => ({ value: t, label: OPPORTUNITY_META[t].short, count: byType[t]?.count ?? 0, title: OPPORTUNITY_META[t].label })),
          ]}
        />

        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-2.5 border-b border-line bg-primary-soft/60 px-5 py-2.5 text-[13px] animate-fade-in">
            <span className="font-semibold text-ink">
              {selected.length} selecionada{selected.length > 1 ? "s" : ""}
            </span>
            {canUpdate ? (
              QUICK_STATUS.map(({ status: to, label, icon: Icon }) => (
                <Button key={to} size="sm" variant="secondary" disabled={changeStatus.isPending} onClick={() => changeStatus.mutate({ ids: selected, to })}>
                  {changeStatus.isPending && changeStatus.variables?.to === to ? <LoaderCircle className="size-3.5 animate-spin" /> : <Icon className="size-3.5" />}
                  {label}
                </Button>
              ))
            ) : (
              <span className="text-ink-3">Seu perfil não altera status.</span>
            )}
            <button type="button" onClick={() => setSelected([])} className="ml-auto text-[12.5px] font-semibold text-primary-ink hover:underline">
              Limpar seleção
            </button>
          </div>
        )}

        {list.error ? (
          <ErrorState error={list.error} />
        ) : !list.data ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title="Nenhuma oportunidade com esses filtros" description="Ajuste os filtros ou escolha outra categoria." />
        ) : (
          <div className={cn("overflow-x-auto px-5 pt-3 transition-opacity", list.isFetching && list.isPlaceholderData && "opacity-60")}>
            <table className="w-full min-w-[1080px] text-left text-[13.5px]">
              <thead>
                <tr className="bg-surface-2 text-[12.5px] text-ink-2">
                  <th className="w-11 rounded-l-lg py-2.5 pl-4">
                    <input
                      type="checkbox"
                      aria-label="Selecionar todas da página"
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? selected.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...selected, ...pageIds])))}
                      className="size-4 cursor-pointer accent-primary"
                    />
                  </th>
                  <th className="px-3 py-2.5 font-medium">Cliente</th>
                  <th className="px-3 py-2.5 font-medium">Oportunidade</th>
                  <th className="px-3 py-2.5 font-medium">Produto</th>
                  <SortHeader label="Score" column="score" sort={sort} order={order} onSort={toggleSort} />
                  <SortHeader label="Valor potencial" column="estimated_value" sort={sort} order={order} onSort={toggleSort} />
                  <th className="px-3 py-2.5 font-medium">Prioridade</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="rounded-r-lg px-4 py-2.5 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <OpportunityRow
                    key={o.opportunity_id}
                    o={o}
                    selected={selected.includes(o.opportunity_id)}
                    canUpdate={canUpdate}
                    onSelect={() =>
                      setSelected((ids) => (ids.includes(o.opportunity_id) ? ids.filter((id) => id !== o.opportunity_id) : [...ids, o.opportunity_id]))
                    }
                    onOpen={() => router.push(`/oportunidades/${o.opportunity_id}`)}
                    onStatus={(to) => changeStatus.mutate({ ids: [o.opportunity_id], to })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {list.data && list.data.total > 0 && (
          <Pagination
            page={list.data.page}
            pages={list.data.pages}
            total={list.data.total}
            pageSize={PAGE_SIZE}
            noun="oportunidades"
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
      <button type="button" onClick={() => onSort(column)} className={cn("inline-flex items-center gap-1 whitespace-nowrap hover:text-ink", active && "text-ink")}>
        {label}
        <Icon className="size-3.5" />
      </button>
    </th>
  );
}

function OpportunityRow({
  o,
  selected,
  canUpdate,
  onSelect,
  onOpen,
  onStatus,
}: {
  o: OpportunityListItem;
  selected: boolean;
  canUpdate: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onStatus: (status: OpportunityStatus) => void;
}) {
  const stop = (event: React.MouseEvent) => event.stopPropagation();
  return (
    <tr onClick={onOpen} className={cn("cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-[#f9fbfe]", selected && "bg-primary-soft/40")}>
      <td className="py-2.5 pl-4" onClick={stop}>
        <input type="checkbox" aria-label={`Selecionar ${o.title} de ${o.customer_name}`} checked={selected} onChange={onSelect} className="size-4 cursor-pointer accent-primary" />
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-3">
          <Avatar name={o.customer_name} />
          <div className="min-w-0">
            <Link href={`/clientes/${o.customer_id}`} onClick={stop} className="block font-semibold whitespace-nowrap text-ink hover:text-primary-ink">
              {o.customer_name}
            </Link>
            <div className="text-[12px] text-ink-3">{shortId(o.customer_id)}</div>
          </div>
        </div>
      </td>
      <td className="max-w-[260px] px-3 py-2.5">
        <Link href={`/oportunidades/${o.opportunity_id}`} onClick={stop} className="line-clamp-2 leading-snug text-ink hover:text-primary-ink">
          {o.title}
        </Link>
      </td>
      <td className="px-3 py-2.5">
        <OpportunityPill type={o.type} short />
      </td>
      <td className="px-3 py-2.5" onClick={stop}>
        <ScoreExplain score={o.score} title={o.type_label} reasons={o.top_evidence} />
      </td>
      <td className="tnum px-3 py-2.5 font-medium whitespace-nowrap text-ink">{brl(o.estimated_value)}</td>
      <td className="px-3 py-2.5">
        <PriorityBadge priority={o.priority} />
      </td>
      <td className="px-3 py-2.5">
        <StatusBadge status={o.status} />
      </td>
      <td className="px-4 py-2.5" onClick={stop}>
        <div className="flex items-center justify-end gap-2">
          <Link href={`/oportunidades/${o.opportunity_id}`} className={buttonClass("soft", "sm", "h-8 w-16")}>
            Ver
          </Link>
          <Dropdown label={`Ações para ${o.title}`} width={240} triggerClassName="grid size-8 place-items-center rounded-md text-ink-2 hover:bg-surface-3" trigger={<Ellipsis className="size-5" />}>
            {(close) => (
              <>
                <MenuItem icon={ExternalLink} href={`/oportunidades/${o.opportunity_id}`} onSelect={close}>
                  Abrir oportunidade
                </MenuItem>
                <MenuItem icon={UserRound} href={`/clientes/${o.customer_id}`} onSelect={close}>
                  Abrir Customer 360
                </MenuItem>
                <MenuItem icon={Calculator} href={`/simulador?opportunity=${o.opportunity_id}`} onSelect={close}>
                  Simular proposta
                </MenuItem>
                {canUpdate && (
                  <>
                    <MenuDivider />
                    <MenuLabel>Alterar status</MenuLabel>
                    {QUICK_STATUS.filter((s) => s.status !== o.status).map(({ status, label, icon }) => (
                      <MenuItem
                        key={status}
                        icon={icon}
                        danger={status === "dismissed"}
                        onSelect={() => {
                          onStatus(status);
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
      </td>
    </tr>
  );
}
