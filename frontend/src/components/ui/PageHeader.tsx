import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export function BackLink({ href, children = "Voltar" }: { href: string; children?: React.ReactNode }) {
  return (
    <Link href={href} className="mb-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink">
      <ArrowLeft className="size-4" /> {children}
    </Link>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight text-heading">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-[14px] text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}
