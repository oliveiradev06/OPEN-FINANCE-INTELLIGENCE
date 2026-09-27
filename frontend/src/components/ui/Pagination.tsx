import { ChevronLeft, ChevronRight } from "lucide-react";
import { num } from "@/lib/format";
import { cn } from "@/lib/utils";

function pageList(page: number, pages: number): (number | "gap")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, "gap", pages];
  if (page >= pages - 3) return [1, "gap", pages - 4, pages - 3, pages - 2, pages - 1, pages];
  return [1, "gap", page - 1, page, page + 1, "gap", pages];
}

/** Numbered pagination ("1 2 3 4 5 … 100") plus "Mostrando 1–10 de 4.281 <noun>". */
export function Pagination({
  page,
  pages,
  total,
  pageSize,
  noun,
  onChange,
}: {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  noun: string;
  onChange: (page: number) => void;
}) {
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, total);
  const arrow = "grid size-8 place-items-center rounded-md bg-surface-3 text-ink-2 transition-colors hover:bg-[#e2e9f2] disabled:opacity-40";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <nav className="flex items-center gap-1" aria-label="Paginação">
        <button type="button" className={arrow} disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Página anterior">
          <ChevronLeft className="size-4" />
        </button>
        {pageList(page, pages).map((item, i) =>
          item === "gap" ? (
            <span key={`gap-${i}`} className="px-1.5 text-[13px] text-ink-3">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onChange(item)}
              aria-current={item === page ? "page" : undefined}
              className={cn(
                "tnum h-8 min-w-8 rounded-md px-2 text-[13px] transition-colors",
                item === page ? "bg-pagination font-semibold text-white" : "font-medium text-ink-2 hover:bg-surface-3",
              )}
            >
              {item}
            </button>
          ),
        )}
        <button type="button" className={arrow} disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Próxima página">
          <ChevronRight className="size-4" />
        </button>
      </nav>
      <span className="tnum text-[13px] text-ink-2">
        Mostrando {num(from)}–{num(to)} de {num(total)} {noun}
      </span>
    </div>
  );
}
