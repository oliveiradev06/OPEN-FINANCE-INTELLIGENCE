"use client";

import { useQuery } from "@tanstack/react-query";
import { CornerDownLeft, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { OpportunityIcon } from "@/components/ui/OpportunityTag";
import { api } from "@/lib/api";
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

  const go = (customerId: string) => {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    router.push(`/clientes/${customerId}`);
  };

  const showList = open && term.length >= 2;

  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
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
          if (!showList || hits.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (i + 1) % hits.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i - 1 + hits.length) % hits.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            go(hits[active].customer_id);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder="Buscar cliente por nome ou ID…"
        className="h-10 w-full rounded-lg border border-line bg-surface pr-16 pl-9 text-[13.5px] text-ink placeholder:text-ink-3 outline-none transition focus:border-accent/50 focus:bg-surface-2"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border border-line-strong px-1.5 py-0.5 text-[10.5px] text-ink-3 sm:block">
        Ctrl K
      </kbd>
      {showList && (
        <div
          id={listId}
          role="listbox"
          className="absolute top-12 left-0 z-50 w-full overflow-hidden rounded-xl border border-line-strong bg-surface-2 shadow-2xl shadow-black/60 animate-fade-in"
        >
          {hits.length === 0 ? (
            <div className="px-4 py-3 text-[13px] text-ink-3">{isFetching ? "Buscando…" : "Nenhum cliente encontrado."}</div>
          ) : (
            hits.map((hit, index) => (
              <button
                key={hit.customer_id}
                role="option"
                aria-selected={index === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(hit.customer_id)}
                onMouseEnter={() => setActive(index)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-2.5 text-left",
                  index === active ? "bg-surface-3" : "hover:bg-surface-3",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-medium text-ink">{hit.name}</div>
                  <div className="text-[12px] text-ink-3">
                    {hit.customer_id} · {hit.segment}
                  </div>
                </div>
                {hit.top_opportunity_type && (
                  <span className="flex items-center gap-1.5 text-[12px] text-ink-2">
                    <OpportunityIcon type={hit.top_opportunity_type} className="size-3.5" />
                    <span className="tnum font-semibold text-ink">{hit.opportunity_score}</span>
                  </span>
                )}
                {index === active && <CornerDownLeft className="size-3.5 text-ink-3" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
