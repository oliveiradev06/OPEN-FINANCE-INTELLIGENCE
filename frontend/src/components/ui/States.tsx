import { CircleAlert, Lock, SearchX } from "lucide-react";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-white/[0.045]", className)} />;
}

export function EmptyState({ title, description, className }: { title: string; description?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-12 text-center", className)}>
      <SearchX className="size-6 text-ink-3" />
      <div className="text-[14px] font-medium text-ink">{title}</div>
      {description && <p className="max-w-sm text-[13px] text-ink-3">{description}</p>}
    </div>
  );
}

export function ErrorState({ error, className }: { error: unknown; className?: string }) {
  const forbidden = error instanceof ApiError && error.status === 403;
  const Icon = forbidden ? Lock : CircleAlert;
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-12 text-center", className)}>
      <Icon className={cn("size-6", forbidden ? "text-warning" : "text-critical")} />
      <div className="text-[14px] font-medium text-ink">
        {forbidden ? "Acesso restrito ao seu perfil" : "Não foi possível carregar os dados"}
      </div>
      <p className="max-w-md text-[13px] text-ink-3">
        {error instanceof Error
          ? error.message
          : "Verifique se a API está em execução (uvicorn na porta 8000)."}
      </p>
    </div>
  );
}
