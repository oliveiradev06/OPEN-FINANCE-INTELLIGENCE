import type { InstitutionRef } from "@/lib/types";
import { cn, inkOn } from "@/lib/utils";

function monogram(inst: Pick<InstitutionRef, "short_name">): string {
  const name = inst.short_name.replace(/[^A-Za-zÀ-ÿ0-9 ]/g, "");
  const words = name.split(" ").filter(Boolean);
  if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const SIZE = { xs: "size-5 text-[8.5px]", sm: "size-6 text-[9.5px]", md: "size-8 text-[11px]", lg: "size-11 text-[14px]" };

/** Institution identity as a monogram tile (brand color is identity, like a logo — not data encoding). */
export function InstitutionAvatar({
  institution,
  size = "sm",
  className,
}: {
  institution: Pick<InstitutionRef, "short_name" | "brand_color" | "name">;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  return (
    <span
      title={institution.name}
      className={cn("inline-grid shrink-0 place-items-center rounded-md font-bold tracking-tight ring-1 ring-black/40", SIZE[size], className)}
      style={{ backgroundColor: institution.brand_color, color: inkOn(institution.brand_color) }}
    >
      {monogram(institution)}
    </span>
  );
}

export function InstitutionStack({ institutions, max = 5 }: { institutions: InstitutionRef[]; max?: number }) {
  const shown = institutions.slice(0, max);
  const rest = institutions.length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((inst, i) => (
        <InstitutionAvatar
          key={inst.institution_id}
          institution={inst}
          size="xs"
          className={cn("ring-2 ring-surface", i > 0 && "-ml-1.5")}
        />
      ))}
      {rest > 0 && <span className="ml-1.5 text-[11.5px] text-ink-3">+{rest}</span>}
    </div>
  );
}
