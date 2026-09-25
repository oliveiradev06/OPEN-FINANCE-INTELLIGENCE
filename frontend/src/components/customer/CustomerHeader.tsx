import { CalendarClock, FileLock2, Radar, Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { InstitutionAvatar } from "@/components/ui/InstitutionAvatar";
import { ScoreRing } from "@/components/ui/Meter";
import { HoverPopover } from "@/components/ui/Popover";
import { ScoreExplain } from "@/components/ui/ScoreExplain";
import { dateBR, initials, num, relativeTime } from "@/lib/format";
import { BAND_META, OPPORTUNITY_META } from "@/lib/labels";
import type { Customer360 } from "@/lib/types";

export function CustomerHeader({ data }: { data: Customer360 }) {
  const { customer, health, metrics } = data;
  const band = BAND_META[health.band];
  const top = data.opportunities[0];

  return (
    <Card className="relative overflow-hidden p-6">
      <div className="pointer-events-none absolute -top-32 -left-24 size-80 rounded-full bg-accent/[0.07] blur-3xl" />
      <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-accent/70 to-blue/70 p-[2px]">
            <div className="grid size-full place-items-center rounded-[14px] bg-[#0b1322] text-[20px] font-semibold text-ink">
              {initials(customer.name)}
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-ink">{customer.name}</h1>
              <Badge>{customer.segment}</Badge>
              {data.segment && (
                <Badge className="bg-blue/10 text-[#8fb9f0] ring-blue/20" title={data.segment.description}>
                  <Users className="size-3" /> {data.segment.name}
                </Badge>
              )}
            </div>
            <div className="mt-1 text-[13px] text-ink-3">
              {customer.customer_id} · {customer.age_range} anos · {customer.occupation_category} · {customer.state}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-ink-2">
                <CalendarClock className="size-3.5 text-ink-3" /> Cliente desde {dateBR(customer.relationship_since)} ({num(customer.tenure_years, 1)} anos)
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-ink-2">
                Salário em <InstitutionAvatar institution={customer.primary_bank} size="xs" /> {customer.primary_bank.short_name}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-ink-2">
                <FileLock2 className="size-3.5 text-accent" />
                {data.consent.active + data.consent.expiring} consentimentos ativos
                {data.consent.expiring > 0 && <span className="text-warning">· {data.consent.expiring} expirando</span>}
                <span className="text-ink-3">· sincronizado {relativeTime(data.last_sync_at)}</span>
              </span>
              {data.anomaly.is_anomaly && (
                <Badge className="bg-violet/12 text-[#c9c3f7] ring-violet/25" title={data.anomaly.reasons.join(" · ")}>
                  <Radar className="size-3" /> Comportamento atípico
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 gap-3">
          <div className="flex items-center gap-4 rounded-xl border border-line bg-surface-2/60 px-4 py-3">
            <ScoreRing value={health.score} color={band.color} size={68} label={`Financial Health ${health.score}`} />
            <div>
              <div className="text-[12px] font-medium text-ink-2">Financial Health</div>
              <div className={`text-[14px] font-semibold ${band.text}`}>{band.label}</div>
              <HoverPopover
                width={360}
                trigger={<span className="text-[11.5px] text-ink-3 underline decoration-dotted underline-offset-2">Como é calculado</span>}
              >
                <div className="mb-2 text-[12.5px] font-medium text-ink-2">Composição do score ({health.score}/100)</div>
                <div className="space-y-1.5">
                  {health.components.map((c) => (
                    <div key={c.key} className="flex justify-between gap-3 text-[12.5px]">
                      <span className="text-ink-2">
                        {c.label} <span className="text-ink-3">({c.display})</span>
                      </span>
                      <span className="tnum shrink-0 text-ink">+{num(c.points, 1)}</span>
                    </div>
                  ))}
                </div>
              </HoverPopover>
            </div>
          </div>
          {top && (
            <div className="flex items-center gap-4 rounded-xl border border-accent/25 bg-accent/[0.04] px-4 py-3">
              <ScoreRing value={top.score} color="var(--color-accent)" size={68} label={`Opportunity Score ${top.score}`} />
              <div>
                <div className="text-[12px] font-medium text-ink-2">Opportunity Score</div>
                <div className="text-[14px] font-semibold text-accent-soft">{OPPORTUNITY_META[top.type].label}</div>
                <div className="text-[11.5px] text-ink-3">
                  <ScoreExplain score={top.score} size="sm" title={top.type_label} factors={top.score_breakdown} reasons={top.evidence} />{" "}
                  · {metrics.opportunities_count} oportunidade{metrics.opportunities_count === 1 ? "" : "s"}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
