"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileLock2, History, Landmark, Lightbulb, LoaderCircle, Lock, ShieldCheck, Star, Target, UsersRound } from "lucide-react";
import { useState } from "react";
import { IconTile } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { ApiError, api } from "@/lib/api";
import { num, relativeTime } from "@/lib/format";
import { OPPORTUNITY_META, OPPORTUNITY_ORDER, STATUS_META } from "@/lib/labels";
import { useRole } from "@/lib/role";
import type { Tone } from "@/lib/tones";
import type { OpportunityStatus, ReportInfo } from "@/lib/types";

const LOOK: Record<string, { icon: typeof Target; tone: Tone }> = {
  clientes: { icon: UsersRound, tone: "blue" },
  oportunidades: { icon: Target, tone: "green" },
  "clientes-prioritarios": { icon: Star, tone: "amber" },
  instituicoes: { icon: Landmark, tone: "teal" },
  insights: { icon: Lightbulb, tone: "violet" },
  consentimentos: { icon: FileLock2, tone: "navy" },
  auditoria: { icon: History, tone: "gray" },
};

function ReportCard({ report }: { report: ReportInfo }) {
  const client = useQueryClient();
  const [filters, setFilters] = useState({ type: "", priority: "", status: "" });
  const download = useMutation({
    mutationFn: () => api.downloadReport(report.key, report.key === "oportunidades" ? filters : {}),
    onSuccess: () => client.invalidateQueries({ queryKey: ["reports"] }),
  });
  const look = LOOK[report.key] ?? { icon: Download, tone: "gray" as Tone };
  return (
    <Card className="flex h-full flex-col p-5">
      <div className="flex items-start gap-3.5">
        <IconTile icon={look.icon} tone={look.tone} size="lg" className="rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[15.5px] font-semibold text-[#0e1a3a]">{report.title}</h2>
            <Badge tone="gray" size="sm">
              CSV · {num(report.rows)} linhas
            </Badge>
          </div>
          <p className="mt-1 text-[13px] leading-snug text-ink-2">{report.description}</p>
        </div>
      </div>

      {report.key === "oportunidades" && report.available && (
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <FilterSelect label="Tipo" value={filters.type} onChange={(type) => setFilters((f) => ({ ...f, type }))} options={OPPORTUNITY_ORDER.map((t) => ({ value: t, label: OPPORTUNITY_META[t].label }))} />
          <FilterSelect
            label="Prioridade"
            value={filters.priority}
            onChange={(priority) => setFilters((f) => ({ ...f, priority }))}
            options={[
              { value: "high", label: "Alta" },
              { value: "medium", label: "Média" },
              { value: "low", label: "Baixa" },
            ]}
          />
          <FilterSelect
            label="Status"
            value={filters.status}
            onChange={(status) => setFilters((f) => ({ ...f, status }))}
            options={(Object.keys(STATUS_META) as OpportunityStatus[]).map((s) => ({ value: s, label: STATUS_META[s].label }))}
          />
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
        <span className="text-[12.5px] text-ink-3">
          {report.last_export ? `Última exportação ${relativeTime(report.last_export)}` : "Ainda não exportado"}
        </span>
        {report.available ? (
          <Button variant="soft" onClick={() => download.mutate()} disabled={download.isPending}>
            {download.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
            Baixar CSV
          </Button>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-3">
            <Lock className="size-3.5 text-warning" /> Requer: {report.permission_label}
          </span>
        )}
      </div>
      {download.error && (
        <p className="mt-2 text-[12.5px] text-critical">{download.error instanceof ApiError ? download.error.message : "Falha na exportação."}</p>
      )}
    </Card>
  );
}

export default function ReportsPage() {
  const role = useRole();
  const { data, error } = useQuery({ queryKey: ["reports", role], queryFn: api.reports });

  return (
    <div className="animate-fade-in">
      <PageHeader title="Relatórios" description="Exportações em CSV para análise fora da plataforma, com as mesmas regras de acesso da tela" />
      {error ? (
        <ErrorState error={error} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="grid content-start gap-4 lg:grid-cols-2">
            {data ? data.map((report) => <ReportCard key={report.key} report={report} />) : Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
          </div>
          <Card className="h-fit">
            <CardHeader icon={<ShieldCheck className="size-4 text-accent" />} title="Como as exportações são tratadas" />
            <ul className="space-y-3 px-5 pb-5 text-[13px] leading-snug text-ink-2">
              <li>
                <span className="font-semibold text-ink">Permissão verificada na API.</span> O botão só baixa o que o seu perfil pode ver; o auditor, por
                exemplo, não exporta dados de clientes.
              </li>
              <li>
                <span className="font-semibold text-ink">Auditoria.</span> Cada download registra analista, perfil, relatório, filtros e número de linhas.
              </li>
              <li>
                <span className="font-semibold text-ink">Dados mínimos.</span> Clientes aparecem pelo ID interno e nome; não há CPF, endereço, contato ou
                transações.
              </li>
              <li>
                <span className="font-semibold text-ink">Pronto para o Excel.</span> Separador ponto e vírgula, decimais com vírgula e UTF-8 com BOM.
              </li>
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
