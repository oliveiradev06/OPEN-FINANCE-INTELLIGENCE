import { CircleAlert, Lock, SearchX } from "lucide-react";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-[#e9eef5]", className)} />;
}

export function EmptyState({
  title,
  description,
  className,
  icon: Icon = SearchX,
}: {
  title: string;
  description?: string;
  className?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-12 text-center", className)}>
      <span className="grid size-11 place-items-center rounded-full bg-surface-3">
        <Icon className="size-5 text-ink-3" />
      </span>
      <div className="text-[14px] font-semibold text-ink">{title}</div>
      {description && <p className="max-w-sm text-[13px] text-ink-3">{description}</p>}
    </div>
  );
}

export function ErrorState({ error, className }: { error: unknown; className?: string }) {
  const forbidden = error instanceof ApiError && error.status === 403;
  const Icon = forbidden ? Lock : CircleAlert;
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-12 text-center", className)}>
      <span className={cn("grid size-11 place-items-center rounded-full", forbidden ? "bg-[#fdf1d3]" : "bg-[#fde6e4]")}>
        <Icon className={cn("size-5", forbidden ? "text-warning" : "text-critical")} />
      </span>
      <div className="text-[14px] font-semibold text-ink">
        {forbidden ? "Acesso restrito ao seu perfil" : "Não foi possível carregar os dados"}
      </div>
      <p className="max-w-md text-[13px] text-ink-3">
        {error instanceof Error ? error.message : "Verifique se a API está em execução (porta 8000)."}
      </p>
    </div>
  );
}
