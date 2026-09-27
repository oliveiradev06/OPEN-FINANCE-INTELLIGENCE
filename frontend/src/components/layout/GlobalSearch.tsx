"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CornerDownLeft, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { OpportunityPill } from "@/components/ui/OpportunityTag";
import { ScoreBadge } from "@/components/ui/ScoreExplain";
import { api } from "@/lib/api";
import { OPPORTUNITY_META, OPPORTUNITY_ORDER } from "@/lib/labels";
import { useRole } from "@/lib/role";
import { cn } from "@/lib/utils";

function useDebounced<T>(value: T, delay = 200): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

const normalize = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

type Result = { key: string; href: string; render: (active: boolean) => React.ReactNode };

export function GlobalSearch() {
  const router = useRouter();
  const role = useRole();
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const term = useDebounced(query.trim());

  const { data: hits = [], isFetching } = useQuery({
    queryKey: ["search", term, role],
    queryFn: () => api.searchCustomers(term),
    enabled: term.length >= 2,
    staleTime: 30_000,
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo<Result[]>(() => {
    if (term.length < 2) return [];
    const needle = normalize(term);
    const types = OPPORTUNITY_ORDER.filter((t) => normalize(`${OPPORTUNITY_META[t].label} ${OPPORTUNITY_META[t].short}`).includes(needle));
    return [
      ...hits.map((hit) => ({
        key: hit.customer_id,
        href: `/clientes/${hit.customer_id}`,
        render: () => (
          <>
            <Avatar name={hit.name} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-medium text-ink">{hit.name}</div>
              <div className="text-[12px] text-ink-3">
                {hit.customer_id} · {hit.segment}
              </div>
            </div>
            {hit.top_opportunity_type && <ScoreBadge score={hit.opportunity_score} size="sm" />}
          </>
        ),
      })),
      ...types.map((type) => ({
        key: `type-${type}`,
        href: `/oportunidades?type=${type}`,
        render: () => (
          <>
            <OpportunityPill type={type} icon />
            <span className="flex-1 text-[13px] text-ink-2">Ver oportunidades desta categoria</span>
          </>
        ),
      })),
      {
        key: "all-customers",
        href: `/clientes?search=${encodeURIComponent(term)}`,
        render: () => (
          <span className="flex flex-1 items-center gap-2 text-[13px] font-medium text-primary-ink">
            <ArrowRight className="size-4" /> Buscar “{term}” na lista de clientes
          </span>
        ),
      },
    ];
  }, [hits, term]);

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    router.push(href);
  };

  const showList = open && term.length >= 2;

  return (
    <div className="relative w-full min-w-0 max-w-[520px]">
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-ink-3" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!showList || results.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (i + 1) % results.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i - 1 + results.length) % results.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            go(results[Math.min(active, results.length - 1)].href);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder="Buscar clientes, IDs ou oportunidades…"
        className="h-11 w-full rounded-lg border border-line-strong bg-white pr-16 pl-10 text-[13.5px] text-ink shadow-[0_1px_2px_rgb(16_32_64/0.04)] outline-none placeholder:text-ink-3 focus:border-primary/60 focus:ring-3 focus:ring-primary/10"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border border-line-strong bg-surface-2 px-1.5 py-0.5 text-[10.5px] text-ink-3 sm:block">
        Ctrl K
      </kbd>
      {showList && (
        <div
          id={listId}
          role="listbox"
          className="absolute top-[52px] left-0 z-50 w-full overflow-hidden rounded-xl border border-line bg-white p-1.5 shadow-pop animate-fade-in"
        >
          {hits.length === 0 && isFetching && <div className="px-3 py-2.5 text-[13px] text-ink-3">Buscando…</div>}
          {results.map((result, index) => (
            <button
              key={result.key}
              type="button"
              role="option"
              aria-selected={index === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go(result.href)}
              onMouseEnter={() => setActive(index)}
              className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left", index === active && "bg-surface-2")}
            >
              {result.render(index === active)}
              {index === active && <CornerDownLeft className="size-3.5 shrink-0 text-ink-3" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
