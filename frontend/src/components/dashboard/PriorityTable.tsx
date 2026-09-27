"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { buttonClass } from "@/components/ui/Button";
import { OpportunityPills } from "@/components/ui/OpportunityTag";
import { ScoreExplain } from "@/components/ui/ScoreExplain";
import { shortId } from "@/lib/format";
import type { PriorityCustomer } from "@/lib/types";
import { cn } from "@/lib/utils";

type Sort = { key: "name" | "score"; dir: "asc" | "desc" };

function SortButton({ label, active, dir, onClick }: { label: string; active: boolean; dir: "asc" | "desc"; onClick: () => void }) {
  const Icon = !active ? ChevronsUpDown : dir === "desc" ? ArrowDown : ArrowUp;
  return (
    <button type="button" onClick={onClick} className={cn("inline-flex items-center gap-1 hover:text-ink", active && "text-ink")}>
      {label}
      <Icon className="size-3.5" />
    </button>
  );
}

/** "Clientes em destaque": score with its explanation, main opportunity types and a detail link. */
export function PriorityTable({ rows }: { rows: PriorityCustomer[] }) {
  const [sort, setSort] = useState<Sort>({ key: "score", dir: "desc" });
  const sorted = [...rows].sort((a, b) => {
    const diff = sort.key === "score" ? a.opportunity_score - b.opportunity_score : a.name.localeCompare(b.name, "pt-BR");
    return sort.dir === "desc" ? -diff : diff;
  });
  const toggle = (key: Sort["key"]) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: key === "name" ? "asc" : "desc" }));

  return (
    <div className="overflow-x-auto px-5 pb-4">
      <table className="w-full min-w-[620px] text-left text-[13.5px]">
        <thead>
          <tr className="bg-surface-2 text-[12.5px] text-ink-2">
            <th className="rounded-l-lg px-4 py-2.5 font-medium">
              <SortButton label="Cliente" active={sort.key === "name"} dir={sort.dir} onClick={() => toggle("name")} />
            </th>
            <th className="w-[92px] px-3 py-2.5 font-medium">
              <SortButton label="Score" active={sort.key === "score"} dir={sort.dir} onClick={() => toggle("score")} />
            </th>
            <th className="w-[44%] px-3 py-2.5 font-medium">Principais oportunidades</th>
            <th className="rounded-r-lg px-4 py-2.5 text-right font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.customer_id} className="border-b border-line last:border-0">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar name={row.name} />
                  <div className="min-w-0">
                    <Link href={`/clientes/${row.customer_id}`} className="block truncate font-semibold text-ink hover:text-primary-ink">
                      {row.name}
                    </Link>
                    <div className="text-[12px] text-ink-3">{shortId(row.customer_id)}</div>
                  </div>
                </div>
              </td>
              <td className="px-3 py-3">
                <ScoreExplain score={row.opportunity_score} title={row.opportunity_label} factors={row.score_breakdown} reasons={row.reasons} />
              </td>
              <td className="px-3 py-3">
                <OpportunityPills types={row.opportunity_types.length ? row.opportunity_types : [row.opportunity_type]} />
              </td>
              <td className="px-4 py-3 text-right">
                <Link href={`/clientes/${row.customer_id}`} className={buttonClass("soft", "sm", "h-9 px-4")}>
                  Ver detalhes
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
