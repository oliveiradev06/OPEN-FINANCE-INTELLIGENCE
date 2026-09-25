"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Check, Cpu, FileLock2, History, LoaderCircle, Lock, Play, ShieldCheck, Sparkles, UserRound, X } from "lucide-react";
import { useState } from "react";
import { ShareBar } from "@/components/charts/ShareBar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { OpportunityTag } from "@/components/ui/OpportunityTag";
import { PageHeader } from "@/components/ui/PageHeader";
import { Segmented } from "@/components/ui/Segmented";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { ApiError, api } from "@/lib/api";
import { dateTimeBR, num, pct } from "@/lib/format";
import { useCan } from "@/lib/hooks";
import { ACTION_LABELS } from "@/lib/labels";
import { useRole } from "@/lib/role";
import type { EngineConfig } from "@/lib/types";

type Tab = "engine" | "lgpd" | "audit" | "access" | "ai";

const PARAM_LABELS: Record<string, string> = {
  min_avg_balance: "Saldo médio mínimo (R$)",
  max_balance_cv: "Variação máxima do saldo",
  min_stable_months: "Meses estáveis (mín.)",
  buffer_months: "Folga operacional (meses)",
  min_idle_amount: "Valor ocioso mínimo (R$)",
  max_turnover: "Giro mensal máximo",
  max_expensive_debt: "Dívida cara máxima (R$)",
  min_external: "Investimento externo mínimo (R$)",
  min_external_share: "Participação externa mínima",
  expensive_rate: "Taxa de dívida cara (% a.m.)",
  min_expensive_debt: "Dívida cara mínima (R$)",
  min_coverage: "Cobertura mínima pelo saldo",
  min_spread: "Spread mínimo (p.p. a.m.)",
  min_balance: "Saldo devedor mínimo (R$)",
  min_remaining_months: "Prazo restante mínimo (meses)",
  min_card_spend: "Gasto mínimo com cartão (R$/mês)",
  min_external_categories: "Categorias fora do banco (mín.)",
  dominance: "Predominância externa",
  min_income: "Renda mínima (R$)",
  min_score: "Score mínimo do sinal",
  min_balance_drop: "Queda mínima de saldo",
  min_investment_outflow: "Saída mínima de investimentos",
};

const STAGE_LABELS: Record<string, string> = {
  generate: "Geração sintética",
  load_raw: "Carga bruta",
  read_raw: "Leitura bruta",
  engines: "ETL + motores",
  persist: "Persistência",
};

function formatParam(key: string, value: number) {
  if (key.includes("share") || key.includes("cv") || key.includes("dominance") || key.includes("coverage") || key.includes("drop") || key.includes("outflow"))
    return value <= 1 ? pct(value) : num(value, 2);
  if (key.includes("rate") || key.includes("spread") || key.includes("turnover") || key.includes("months")) return num(value, value % 1 ? 2 : 0);
  return num(value);
}

function EngineTab({ config }: { config: EngineConfig }) {
  const client = useQueryClient();
  const canRun = useCan("engine:run");
  const run = useMutation({
    mutationFn: api.runEngine,
    onSuccess: () => client.invalidateQueries(),
  });
  const last = config.runs[0];
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <Cpu className="size-4 text-accent" /> Opportunity Engine v{config.version}
            </div>
            <p className="mt-1 max-w-2xl text-[13px] text-ink-2">
              Motor baseado em regras explicáveis: cada regra soma fatores (0–100) medidos nos dados. Oportunidades abaixo de score{" "}
              {config.min_score} não são exibidas; prioridade alta ≥ {config.priority_thresholds.high}, média ≥ {config.priority_thresholds.medium}.
              Reexecutar mantém o status que os analistas já deram às oportunidades.
            </p>
          </div>
          <div className="shrink-0">
            <Button variant="primary" disabled={!canRun || run.isPending} onClick={() => run.mutate()} title={!canRun ? "Requer perfil Coordenador" : undefined}>
              {run.isPending ? <LoaderCircle className="size-4 animate-spin" /> : canRun ? <Play className="size-4" /> : <Lock className="size-4" />}
              {run.isPending ? "Executando…" : "Executar motor agora"}
            </Button>
            {!canRun && <div className="mt-1.5 text-right text-[11.5px] text-ink-3">Requer perfil Coordenador</div>}
          </div>
        </div>
        {run.data && (
          <div className="mt-4 rounded-lg border border-accent/25 bg-accent/[0.05] p-3 text-[12.5px] text-ink-2">
            <Check className="mr-1 inline size-4 text-accent" /> Execução {run.data.run_id} concluída em {num((run.data.duration_ms ?? 0) / 1000, 1)}s ·{" "}
            {num(run.data.opportunities_created)} oportunidades · {num(run.data.signals_created)} sinais.
          </div>
        )}
        {run.error && <p className="mt-3 text-[12.5px] text-[#f07171]">{run.error instanceof ApiError ? run.error.message : "Falha na execução."}</p>}
        {last?.stats?.stages && (
          <div className="mt-4 flex flex-wrap gap-2 text-[12px]">
            {Object.entries(last.stats.stages).map(([stage, seconds]) => (
              <Badge key={stage}>
                {STAGE_LABELS[stage] ?? stage}: <span className="text-ink">{num(seconds, 1)}s</span>
              </Badge>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {config.rules.map((rule) => (
          <Card key={rule.rule_id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <OpportunityTag type={rule.type} />
              <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-ink-3">{rule.rule_id}</code>
            </div>
            <div className="mt-2 text-[14px] font-semibold text-ink">{rule.name}</div>
            <p className="mt-1 text-[12.5px] leading-snug text-ink-2">{rule.description}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
              {Object.entries(rule.params).map(([key, value]) => (
                <div key={key} className="flex justify-between gap-2 border-b border-line/60 py-1">
                  <dt className="text-ink-3">{PARAM_LABELS[key] ?? key}</dt>
                  <dd className="tnum font-medium text-ink">{formatParam(key, value)}</dd>
                </div>
              ))}
            </dl>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Financial Health Score" subtitle="Componentes e pesos" />
          <div className="space-y-2 px-5 pb-5">
            {config.health_components.map((c) => (
              <div key={c.key} className="flex items-center justify-between gap-3 border-b border-line/60 py-1.5 text-[12.5px] last:border-0">
                <div>
                  <div className="text-ink">{c.label}</div>
                  <div className="text-[11.5px] text-ink-3">{c.metric}</div>
                </div>
                <span className="tnum font-semibold text-ink">{pct(c.weight)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader icon={<History className="size-4" />} title="Execuções recentes" />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead>
                <tr className="border-y border-line text-[11px] tracking-wide text-ink-3 uppercase">
                  <th className="px-5 py-2 font-medium">Execução</th>
                  <th className="px-3 py-2 font-medium">Origem</th>
                  <th className="px-3 py-2 text-right font-medium">Duração</th>
                  <th className="px-3 py-2 text-right font-medium">Oportunidades</th>
                </tr>
              </thead>
              <tbody>
                {config.runs.map((r) => (
                  <tr key={r.run_id} className="border-b border-line/60 last:border-0">
                    <td className="px-5 py-2">
                      <div className="font-mono text-[11.5px] text-ink">{r.run_id}</div>
                      <div className="text-[11.5px] text-ink-3">{dateTimeBR(r.started_at)}</div>
                    </td>
                    <td className="px-3 py-2 text-ink-2">{r.trigger === "seed" ? "Carga inicial" : "Manual"}</td>
                    <td className="tnum px-3 py-2 text-right text-ink">{num((r.duration_ms ?? 0) / 1000, 1)}s</td>
                    <td className="tnum px-3 py-2 text-right text-ink">{num(r.opportunities_created)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

const LGPD_PRINCIPLES = [
  { title: "Consentimento", text: "Dados de outras instituições só entram na análise com consentimento Open Finance ativo; consentimentos revogados deixam de alimentar os motores." },
  { title: "Finalidade", text: "Uso restrito à finalidade consentida: análise de relacionamento e oferta de produtos adequados ao perfil. Registrada em cada acesso." },
  { title: "Minimização", text: "Sem CPF, endereço, telefone ou e-mail. Clientes identificados por ID interno; faixas etárias em vez de datas de nascimento." },
  { title: "Rastreabilidade", text: "Toda visualização de cliente, uso de IA, mudança de status e execução do motor gera registro de auditoria." },
  { title: "Controle de acesso", text: "Perfis com permissões distintas (analista, coordenador, auditor) verificadas na API, não apenas na interface." },
  { title: "Decisões humanas", text: "A plataforma não aprova, nega, limita ou bloqueia nada automaticamente — ela fornece evidências para a decisão do analista." },
  { title: "IA com dados mínimos", text: "O LLM recebe apenas fatos agregados já calculados, sem nome, ID ou transações; toda resposta informa a fonte." },
  { title: "Dados sintéticos", text: "Este ambiente usa exclusivamente dados gerados artificialmente. Nenhum dado bancário real ou credencial é armazenado." },
];

const SCOPE_LABELS: Record<string, string> = {
  contas: "Contas",
  transacoes: "Transações",
  cartoes_credito: "Cartões de crédito",
  investimentos: "Investimentos",
  operacoes_credito: "Operações de crédito",
};

function LgpdTab() {
  const role = useRole();
  const { data, error } = useQuery({ queryKey: ["consents", role], queryFn: api.consents });
  if (error) return <ErrorState error={error} />;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Consentimentos", data?.total],
          ["Ativos", data?.active],
          ["Expirando em 30 dias", data?.expiring],
          ["Revogados", data?.revoked],
        ].map(([label, value]) => (
          <Card key={String(label)} className="p-4">
            <div className="text-[12.5px] text-ink-2">{label}</div>
            <div className="mt-1.5 text-[24px] font-semibold text-ink">{value !== undefined ? num(Number(value)) : "—"}</div>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader icon={<FileLock2 className="size-4" />} title="Consentimentos por instituição" subtitle={data?.purpose ? `Finalidade: ${data.purpose}` : undefined} />
          <div className="space-y-3 px-5 pb-5">
            {data ? (
              data.by_institution.map((row) => {
                const total = row.active + row.expiring + row.revoked;
                return (
                  <div key={row.institution_id}>
                    <div className="mb-1 flex justify-between text-[12.5px]">
                      <span className="text-ink">{row.short_name}</span>
                      <span className="tnum text-ink-3">
                        {num(row.active)} ativos · {num(row.expiring)} expirando · {num(row.revoked)} revogados
                      </span>
                    </div>
                    <ShareBar primaryShare={total ? row.active / total : 0} showLegend={false} height={6} />
                  </div>
                );
              })
            ) : (
              <Skeleton className="h-64" />
            )}
          </div>
        </Card>
        <Card className="xl:col-span-5">
          <CardHeader title="Escopos compartilhados" subtitle="Consentimentos não revogados por tipo de dado" />
          <div className="space-y-2 px-5 pb-5">
            {data &&
              Object.entries(data.scopes).map(([scope, count]) => (
                <div key={scope} className="flex justify-between border-b border-line/60 py-1.5 text-[12.5px] last:border-0">
                  <span className="text-ink-2">{SCOPE_LABELS[scope] ?? scope}</span>
                  <span className="tnum font-medium text-ink">{num(count)}</span>
                </div>
              ))}
          </div>
        </Card>
      </div>
      <Card>
        <CardHeader icon={<ShieldCheck className="size-4" />} title="Princípios LGPD aplicados na arquitetura" />
        <div className="grid gap-3 px-5 pb-5 md:grid-cols-2 xl:grid-cols-4">
          {LGPD_PRINCIPLES.map((p) => (
            <div key={p.title} className="rounded-lg border border-line bg-white/[0.02] p-3.5">
              <div className="text-[13px] font-semibold text-ink">{p.title}</div>
              <p className="mt-1 text-[12.5px] leading-snug text-ink-2">{p.text}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function AuditTab() {
  const role = useRole();
  const canRead = useCan("governance:read");
  const { data, error } = useQuery({ queryKey: ["audit", role], queryFn: () => api.auditLogs(80), enabled: canRead });
  if (!canRead) {
    return (
      <Card className="flex flex-col items-center gap-2 px-6 py-14 text-center">
        <Lock className="size-6 text-warning" />
        <div className="text-[14px] font-medium text-ink">A trilha de auditoria é restrita</div>
        <p className="max-w-md text-[13px] text-ink-3">Troque para o perfil Coordenador ou Auditor (menu lateral) para visualizar os registros de acesso.</p>
      </Card>
    );
  }
  if (error) return <ErrorState error={error} />;
  return (
    <Card>
      <CardHeader title="Trilha de auditoria" subtitle="Quem acessou o quê, quando e com qual finalidade" />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-[12.5px]">
          <thead>
            <tr className="border-y border-line text-[11px] tracking-wide text-ink-3 uppercase">
              <th className="px-5 py-2 font-medium">Data/hora</th>
              <th className="px-3 py-2 font-medium">Analista</th>
              <th className="px-3 py-2 font-medium">Ação</th>
              <th className="px-3 py-2 font-medium">Recurso</th>
              <th className="px-3 py-2 font-medium">Finalidade</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((log) => (
              <tr key={log.id} className="border-b border-line/60 last:border-0">
                <td className="tnum px-5 py-2 whitespace-nowrap text-ink-2">{dateTimeBR(log.timestamp)}</td>
                <td className="px-3 py-2">
                  <div className="text-ink">{log.actor}</div>
                  <div className="text-[11.5px] text-ink-3">{log.role}</div>
                </td>
                <td className="px-3 py-2 text-ink">{ACTION_LABELS[log.action] ?? log.action}</td>
                <td className="px-3 py-2 font-mono text-[11.5px] text-ink-2">{log.resource_id ?? "—"}</td>
                <td className="px-3 py-2 text-ink-3">{log.purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data && <Skeleton className="m-5 h-64" />}
      </div>
    </Card>
  );
}

function AccessTab() {
  const role = useRole();
  const { data } = useQuery({ queryKey: ["access", role], queryFn: api.access });
  if (!data) return <Skeleton className="h-80 rounded-xl" />;
  const permissions = Object.entries(data.permissions);
  return (
    <Card>
      <CardHeader
        icon={<UserRound className="size-4" />}
        title="Perfis e permissões"
        subtitle={`Você está como ${data.current.name} · ${data.current.role_label}. As permissões são verificadas na API em cada requisição.`}
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead>
            <tr className="border-y border-line text-[11.5px] tracking-wide text-ink-3 uppercase">
              <th className="px-5 py-2.5 font-medium">Permissão</th>
              {data.roles.map((r) => (
                <th key={r.key} className={`px-3 py-2.5 text-center font-medium ${r.key === data.current.role ? "text-accent-soft" : ""}`}>
                  {r.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.map(([key, label]) => (
              <tr key={key} className="border-b border-line/60 last:border-0">
                <td className="px-5 py-2.5 text-ink">{label}</td>
                {data.roles.map((r) => (
                  <td key={r.key} className="px-3 py-2.5 text-center">
                    {r.permissions.includes(key) ? <Check className="mx-auto size-4 text-accent" /> : <X className="mx-auto size-4 text-ink-3/60" />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 px-5 py-5 md:grid-cols-3">
        {data.roles.map((r) => (
          <div key={r.key} className="rounded-lg border border-line bg-white/[0.02] p-3.5 text-[12.5px]">
            <div className="font-semibold text-ink">{r.label}</div>
            <p className="mt-1 text-ink-2">{r.description}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function AiTab({ config }: { config: EngineConfig }) {
  const ai = config.ai;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-ink">
          <Sparkles className="size-4 text-violet" /> AI Insight Engine
        </div>
        <div className="mt-4 space-y-2 text-[13px]">
          <div className="flex justify-between border-b border-line/60 py-1.5">
            <span className="text-ink-3">Modo</span>
            <span className="text-ink">{ai.mode === "llm" ? "LLM + guardrails" : "Redator determinístico (sem chave de API)"}</span>
          </div>
          <div className="flex justify-between border-b border-line/60 py-1.5">
            <span className="text-ink-3">Provedor</span>
            <span className="text-ink">{ai.provider ?? "—"}</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-ink-3">Modelo</span>
            <span className="font-mono text-[12px] text-ink">{ai.model ?? "—"}</span>
          </div>
        </div>
        {!ai.enabled && (
          <p className="mt-4 rounded-lg border border-line bg-white/[0.02] p-3 text-[12.5px] text-ink-2">
            Defina <code className="font-mono text-ink">ANTHROPIC_API_KEY</code> no <code className="font-mono text-ink">backend/.env</code> para gerar os textos com
            LLM. Sem a chave, o redator determinístico produz o texto a partir dos mesmos fatos.
          </p>
        )}
      </Card>
      <Card className="p-5">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-ink">
          <Bot className="size-4 text-violet" /> Guardrails
        </div>
        <ul className="mt-3 space-y-2">
          {ai.guardrails.map((g) => (
            <li key={g} className="flex gap-2 text-[12.5px] leading-snug text-ink-2">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-accent" /> {g}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  const role = useRole();
  const [tab, setTab] = useState<Tab>("engine");
  const { data, error } = useQuery({ queryKey: ["engine-config", role], queryFn: api.engineConfig });
  return (
    <div className="animate-fade-in">
      <PageHeader eyebrow="Plataforma" title="Configurações" description="Regras do motor, governança de dados, auditoria, controle de acesso e IA." />
      <Segmented
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: "engine", label: "Motor de oportunidades" },
          { value: "lgpd", label: "Governança & LGPD" },
          { value: "audit", label: "Auditoria" },
          { value: "access", label: "Acesso & permissões" },
          { value: "ai", label: "Inteligência artificial" },
        ]}
      />
      {error ? (
        <ErrorState error={error} />
      ) : !data ? (
        <Skeleton className="h-[60vh] rounded-xl" />
      ) : tab === "engine" ? (
        <EngineTab config={data} />
      ) : tab === "lgpd" ? (
        <LgpdTab />
      ) : tab === "audit" ? (
        <AuditTab />
      ) : tab === "access" ? (
        <AccessTab />
      ) : (
        <AiTab config={data} />
      )}
    </div>
  );
}
