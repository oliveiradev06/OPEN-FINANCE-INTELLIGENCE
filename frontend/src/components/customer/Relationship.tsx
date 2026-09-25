import { ShareBar } from "@/components/charts/ShareBar";
import { InstitutionAvatar } from "@/components/ui/InstitutionAvatar";
import { brlCompact, pct } from "@/lib/format";
import type { EcosystemNode, InstitutionRef, RelationshipRow } from "@/lib/types";

/** Where the customer's money is: one row per institution, primary bank emphasised. */
export function ResourceDistribution({ nodes, onOpen }: { nodes: EcosystemNode[]; onOpen: (id: string) => void }) {
  const total = nodes.reduce((sum, n) => sum + n.account_balance + n.investment_balance, 0) || 1;
  const sorted = [...nodes].sort((a, b) => b.account_balance + b.investment_balance - (a.account_balance + a.investment_balance));
  return (
    <ul className="space-y-3">
      {sorted.map((n) => {
        const assets = n.account_balance + n.investment_balance;
        const share = assets / total;
        return (
          <li key={n.institution.institution_id}>
            <button
              onClick={() => onOpen(n.institution.institution_id)}
              className="-mx-2 w-[calc(100%+1rem)] rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none"
            >
              <div className="flex items-center gap-2.5">
                <InstitutionAvatar institution={n.institution} size="sm" />
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{n.institution.short_name}</span>
                <span className="tnum text-[13px] font-semibold text-ink">{brlCompact(assets)}</span>
                <span className="tnum w-10 text-right text-[12px] text-ink-3">{pct(share)}</span>
              </div>
              <div className="mt-1.5 ml-[34px] h-1.5">
                <div
                  className="h-full rounded-r-[3px]"
                  style={{ width: `${Math.max(share * 100, 1)}%`, backgroundColor: n.institution.is_primary ? "var(--color-accent)" : "var(--color-context)" }}
                />
              </div>
              {n.debt_balance > 0 && (
                <div className="mt-1 ml-[34px] text-[11.5px] text-ink-3">
                  Dívida <span className="tnum text-ink-2">{brlCompact(n.debt_balance)}</span>
                </div>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Relationship map: for each product category, how much sits with the primary bank. */
export function RelationshipMap({ rows, institutions }: { rows: RelationshipRow[]; institutions: Record<string, InstitutionRef> }) {
  return (
    <div className="space-y-4">
      {rows.map((row) => {
        const main = row.held_at.find((h) => !institutions[h.institution_id]?.is_primary);
        const present = row.primary_share !== null;
        return (
          <div key={row.category}>
            <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[12.5px]">
              <span className="font-medium text-ink">{row.label}</span>
              {present ? (
                <span className="flex items-center gap-1.5 text-ink-3">
                  {row.category === "salario"
                    ? row.primary_share === 1
                      ? "No banco principal"
                      : "Em outra instituição"
                    : `${brlCompact(row.primary_value)} no banco · ${brlCompact(row.external_value)} fora`}
                </span>
              ) : (
                <span className="text-ink-3">Não possui</span>
              )}
            </div>
            {present ? (
              <>
                <ShareBar primaryShare={row.primary_share ?? 0} showLegend={false} height={8} />
                {main && (row.primary_share ?? 1) < 1 && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-ink-3">
                    Principal externo:
                    {institutions[main.institution_id] && <InstitutionAvatar institution={institutions[main.institution_id]} size="xs" />}
                    <span className="text-ink-2">{main.short_name}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="h-2 rounded-[4px] border border-dashed border-line-strong" />
            )}
          </div>
        );
      })}
      <div className="flex gap-4 border-t border-line pt-3 text-[11.5px] text-ink-3">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-accent" /> Banco principal</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-context" /> Outras instituições</span>
      </div>
    </div>
  );
}
