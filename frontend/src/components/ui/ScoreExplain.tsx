import { CircleCheck, Info } from "lucide-react";
import { num } from "@/lib/format";
import type { Evidence, ScoreFactor } from "@/lib/types";
import { cn } from "@/lib/utils";
import { HoverPopover } from "./Popover";

export function scoreTone(score: number) {
  if (score >= 80) return "text-accent-soft";
  if (score >= 60) return "text-ink";
  return "text-ink-2";
}

/** A score is never shown without its explanation: hover or focus reveals factors and evidence. */
export function ScoreExplain({
  score,
  title,
  factors,
  reasons,
  size = "md",
}: {
  score: number;
  title?: string;
  factors?: ScoreFactor[];
  reasons?: Evidence[] | string[];
  size?: "sm" | "md" | "lg";
}) {
  const textSize = { sm: "text-[13px]", md: "text-[15px]", lg: "text-[22px]" }[size];
  const reasonTexts = (reasons ?? []).map((r) => (typeof r === "string" ? r : r.text)).slice(0, 4);
  return (
    <HoverPopover
      width={340}
      trigger={
        <span className="inline-flex items-center gap-1">
          <span className={cn("tnum font-semibold", textSize, scoreTone(score))}>{score}</span>
          <Info className="size-3 text-ink-3" aria-hidden="true" />
        </span>
      }
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="text-[12.5px] font-medium text-ink-2">{title ?? "Opportunity Score"}</div>
        <div className="text-[13px] text-ink-3">
          <span className="text-[18px] font-semibold text-ink">{score}</span> / 100
        </div>
      </div>
      {factors && factors.length > 0 && (
        <div className="space-y-2">
          {factors.map((f) => (
            <div key={f.key}>
              <div className="flex items-baseline justify-between gap-2 text-[12px]">
                <span className="text-ink-2">{f.label}</span>
                <span className="tnum text-ink-3">
                  <span className="font-medium text-ink">{num(f.points, 1)}</span>/{f.max_points}
                </span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-blue/15">
                <div className="h-full rounded-full bg-blue" style={{ width: `${(f.points / f.max_points) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
      {reasonTexts.length > 0 && (
        <div className={cn("space-y-1.5", factors?.length ? "mt-3 border-t border-line pt-3" : "")}>
          <div className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Motivos</div>
          {reasonTexts.map((text) => (
            <div key={text} className="flex gap-2 text-[12.5px] leading-snug text-ink-2">
              <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-accent" />
              {text}
            </div>
          ))}
        </div>
      )}
    </HoverPopover>
  );
}
