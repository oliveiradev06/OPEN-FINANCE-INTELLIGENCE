"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { InstitutionStack } from "@/components/ui/InstitutionAvatar";
import { OpportunityTag } from "@/components/ui/OpportunityTag";
import { ScoreExplain } from "@/components/ui/ScoreExplain";
import { brl, relativeTime } from "@/lib/format";
import type { PriorityCustomer } from "@/lib/types";

export function PriorityTable({ rows }: { rows: PriorityCustomer[] }) {
  const router = useRouter();
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-[13px]">
        <thead>
          <tr className="border-y border-line text-[11.5px] tracking-wide text-ink-3 uppercase">
            <th className="px-5 py-2.5 font-medium">Cliente</th>
            <th className="px-3 py-2.5 font-medium">Score</th>
            <th className="px-3 py-2.5 font-medium">Oportunidade</th>
            <th className="px-3 py-2.5 text-right font-medium">Valor</th>
            <th className="px-3 py-2.5 font-medium">Instituições</th>
            <th className="px-3 py-2.5 font-medium">Atualização</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.customer_id}
              onClick={() => router.push(`/clientes/${row.customer_id}`)}
              className="group cursor-pointer border-b border-line/70 transition-colors last:border-0 hover:bg-white/[0.025]"
            >
              <td className="px-5 py-3">
                <Link
                  href={`/clientes/${row.customer_id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="font-medium whitespace-nowrap text-ink outline-none hover:text-accent-soft focus-visible:underline"
                >
                  {row.name}
                </Link>
                <div className="text-[12px] whitespace-nowrap text-ink-3">
                  {row.customer_id} · {row.segment}
                </div>
              </td>
              <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                <ScoreExplain
                  score={row.opportunity_score}
                  title={row.opportunity_label}
                  factors={row.score_breakdown}
                  reasons={row.reasons}
                />
              </td>
              <td className="px-3 py-3">
                <OpportunityTag type={row.opportunity_type} />
              </td>
              <td className="tnum px-3 py-3 text-right font-medium text-ink">{brl(row.estimated_value)}</td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-2">
                  <InstitutionStack institutions={row.institutions} />
                  <span className="text-[12px] text-ink-3">{row.institutions_count}</span>
                </div>
              </td>
              <td className="px-3 py-3 text-[12.5px] whitespace-nowrap text-ink-3">{relativeTime(row.last_update)}</td>
              <td className="pr-4">
                <ChevronRight className="size-4 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
