import { ShareBar } from "@/components/charts/ShareBar";
import { brlCompact, pct } from "@/lib/format";
import type { WalletShare } from "@/lib/types";

export function WalletShareList({ data }: { data: WalletShare }) {
  return (
    <div className="space-y-5">
      {data.products.map((row) => (
        <div key={row.product}>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span className="text-[13px] font-medium text-ink">{row.label}</span>
            <span className="tnum text-[12px] text-ink-3">
              {brlCompact(row.primary)} no banco · {brlCompact(row.external)} fora
            </span>
          </div>
          <ShareBar primaryShare={row.primary_share} showLegend={false} />
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-3">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm bg-accent" />
              Banco principal <span className="tnum font-semibold text-ink">{pct(row.primary_share)}</span>
            </span>
            {row.top_external.slice(0, 3).map((ext) => (
              <span key={ext.institution_id} className="flex items-center gap-1">
                <span className="size-2 rounded-sm bg-context" />
                {ext.short_name} <span className="tnum text-ink-2">{pct(ext.share)}</span>
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
