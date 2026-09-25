export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-1.5 text-[11.5px] font-semibold tracking-[0.16em] text-accent-soft uppercase">{eyebrow}</div>
        )}
        <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1.5 max-w-3xl text-[14px] text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
