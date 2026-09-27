import { CircleCheck } from "lucide-react";
import { num } from "@/lib/format";
import { scoreTone } from "@/lib/labels";
import { toneStyle } from "@/lib/tones";
import type { Evidence, ScoreFactor } from "@/lib/types";
import { cn } from "@/lib/utils";
import { HoverPopover } from "./Popover";

/** Score as a tinted badge: green >= 80, amber 60-79, gray below. */
export function ScoreBadge({ score, size = "md", className }: { score: number; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span
      className={cn(
        "tnum inline-flex items-center justify-center rounded-md font-bold",
        size === "sm" && "h-6 min-w-8 px-1.5 text-[12px]",
        size === "md" && "h-7 min-w-[38px] px-2 text-[13px]",
        size === "lg" && "h-9 min-w-12 px-2.5 text-[16px]",
        className,
      )}
      style={toneStyle(scoreTone(score))}
    >
      {score}
    </span>
  );
}

export function ScoreDetails({
  score,
  title,
  factors,
  reasons,
}: {
  score: number;
  title?: string;
  factors?: ScoreFactor[];
  reasons?: Evidence[] | string[];
}) {
  const reasonTexts = (reasons ?? []).map((r) => (typeof r === "string" ? r : r.text)).slice(0, 4);
  return (
    <>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="text-[12.5px] font-semibold text-ink-2">{title ?? "Opportunity Score"}</div>
        <div className="text-[13px] text-ink-3">
          <span className="text-[18px] font-bold text-ink">{score}</span> / 100
        </div>
      </div>
      {factors && factors.length > 0 && (
        <div className="space-y-2">
          {factors.map((f) => (
            <div key={f.key}>
              <div className="flex items-baseline justify-between gap-2 text-[12px]">
                <span className="text-ink-2">{f.label}</span>
                <span className="tnum text-ink-3">
                  <span className="font-semibold text-ink">{num(f.points, 1)}</span>/{f.max_points}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-primary-soft">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(f.points / f.max_points) * 100}%` }} />
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
    </>
  );
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
  return (
    <HoverPopover width={340} trigger={<ScoreBadge score={score} size={size} />}>
      <ScoreDetails score={score} title={title} factors={factors} reasons={reasons} />
    </HoverPopover>
  );
}
