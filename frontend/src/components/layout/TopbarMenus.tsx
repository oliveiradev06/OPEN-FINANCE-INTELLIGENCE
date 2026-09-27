"use client";

import { useQuery } from "@tanstack/react-query";
import { Bell, Check, ChevronDown, Cpu, Database, ListChecks, LogOut, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { Avatar } from "@/components/ui/Avatar";
import { Dropdown, MenuDivider, MenuItem, MenuLabel } from "@/components/ui/Dropdown";
import { Skeleton } from "@/components/ui/States";
import { api } from "@/lib/api";
import { monthLong, num, relativeTime } from "@/lib/format";
import { useMeta } from "@/lib/hooks";
import { setRole, useRole } from "@/lib/role";
import { signOut } from "@/lib/session";
import { cn } from "@/lib/utils";

const iconButton = "relative grid size-10 place-items-center rounded-lg text-[#1f3a64] transition-colors hover:bg-white/80";

/** Red dot = something needs attention; the numbers live inside the menu. */
function AttentionDot({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="absolute top-1.5 right-1.5 size-2.5 rounded-full bg-critical ring-2 ring-topbar" />;
}

/** Data freshness: reference month, last engine run and AI mode. */
export function StatusMenu() {
  const { data: meta } = useMeta();
  return (
    <Dropdown label="Status dos dados" width={320} triggerClassName={iconButton} trigger={<ListChecks className="size-5" />}>
      <div className="p-2.5">
        <div className="text-[13.5px] font-semibold text-ink">Status da plataforma</div>
        <dl className="mt-3 space-y-2.5 text-[13px]">
          <div className="flex items-start gap-2.5">
            <Database className="mt-0.5 size-4 text-ink-3" />
            <div>
              <dt className="text-ink-3">Dados Open Finance até</dt>
              <dd className="font-medium text-ink">{meta?.reference_month ? monthLong(meta.reference_month) : "—"}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Cpu className="mt-0.5 size-4 text-ink-3" />
            <div>
              <dt className="text-ink-3">Última execução do motor</dt>
              <dd className="font-medium text-ink">
                {meta?.last_run?.finished_at ? `${relativeTime(meta.last_run.finished_at)} · v${meta.last_run.engine_version}` : "—"}
              </dd>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Sparkles className="mt-0.5 size-4 text-ink-3" />
            <div>
              <dt className="text-ink-3">IA explicativa</dt>
              <dd className="font-medium text-ink">{meta?.ai.mode === "llm" ? `LLM · ${meta.ai.model}` : "Redator determinístico (sem chave de API)"}</dd>
            </div>
          </div>
        </dl>
        <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-[12px] text-ink-2">Ambiente de demonstração: todos os dados são sintéticos.</p>
      </div>
    </Dropdown>
  );
}

/** Relevant movements (same feed as the home page). */
export function NotificationsMenu() {
  const role = useRole();
  const { data } = useQuery({ queryKey: ["activity", role], queryFn: api.activity, staleTime: 5 * 60_000 });
  return (
    <Dropdown label="Movimentações relevantes" width={400} triggerClassName={iconButton} trigger={<Bell className="size-5" />} className="p-0">
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-[13.5px] font-semibold text-ink">Movimentações relevantes</span>
            <Link href="/" onClick={close} className="text-[12.5px] font-semibold text-primary-ink hover:underline">
              Ver painel
            </Link>
          </div>
          {data ? <ActivityFeed items={data} compact onNavigate={close} /> : <Skeleton className="m-4 h-40" />}
        </div>
      )}
    </Dropdown>
  );
}

/** LGPD shortcut: consents that expire soon need the customer to renew them. */
export function PrivacyMenu() {
  const role = useRole();
  const { data } = useQuery({ queryKey: ["consents", role], queryFn: api.consents, staleTime: 5 * 60_000 });
  return (
    <Dropdown
      label="Privacidade e consentimentos"
      width={320}
      triggerClassName={iconButton}
      trigger={
        <>
          <ShieldCheck className="size-5" />
          <AttentionDot show={(data?.expiring ?? 0) > 0} />
        </>
      }
    >
      {(close) => (
        <div className="p-2.5">
          <div className="text-[13.5px] font-semibold text-ink">Consentimentos Open Finance</div>
          {data ? (
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                ["Ativos", data.active, "text-accent-ink"],
                ["Expirando", data.expiring, "text-warning"],
                ["Revogados", data.revoked, "text-critical"],
              ].map(([label, value, color]) => (
                <div key={String(label)} className="rounded-lg bg-surface-2 px-2 py-2.5">
                  <div className={cn("tnum text-[18px] font-bold", String(color))}>{num(Number(value))}</div>
                  <div className="text-[11.5px] text-ink-3">{label}</div>
                </div>
              ))}
            </div>
          ) : (
            <Skeleton className="mt-3 h-16" />
          )}
          <p className="mt-3 text-[12.5px] leading-snug text-ink-2">
            Consentimentos que vencem em até 30 dias precisam ser renovados pelo cliente na instituição de origem.
          </p>
          <Link href="/configuracoes?tab=lgpd" onClick={close} className="mt-3 inline-block text-[12.5px] font-semibold text-primary-ink hover:underline">
            Abrir governança e LGPD
          </Link>
        </div>
      )}
    </Dropdown>
  );
}

/** Signed-in analyst: simulated access profile and sign out. */
export function UserMenu() {
  const router = useRouter();
  const role = useRole();
  const { data: meta } = useMeta();
  const name = meta?.analyst.name ?? "Analista";
  return (
    <Dropdown
      label="Menu do usuário"
      width={290}
      triggerClassName="flex items-center gap-2.5 rounded-lg py-1 pr-1.5 pl-1 transition-colors hover:bg-white/80"
      trigger={
        <>
          <Avatar name={name} size="md" variant="brand" className="size-10 text-[13px]" />
          <span className="hidden text-left leading-tight md:block">
            <span className="block text-[13.5px] font-semibold text-ink">{name}</span>
            <span className="block text-[12px] text-ink-3">{meta?.analyst.role_label ?? "—"}</span>
          </span>
          <ChevronDown className="hidden size-4 text-ink-2 md:block" />
        </>
      }
    >
      {(close) => (
        <>
          <MenuLabel>Perfil de acesso (simulado)</MenuLabel>
          {(meta?.roles ?? []).map((r) => (
            <button
              key={r.key}
              type="button"
              role="menuitemradio"
              aria-checked={role === r.key}
              onClick={() => {
                setRole(r.key);
                close();
              }}
              className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-surface-2"
            >
              <Check className={cn("mt-0.5 size-4 shrink-0", role === r.key ? "text-primary" : "text-transparent")} />
              <span>
                <span className="block text-[13.5px] font-medium text-ink">{r.label}</span>
                <span className="block text-[12px] leading-snug text-ink-3">{r.description}</span>
              </span>
            </button>
          ))}
          <MenuDivider />
          <MenuItem
            icon={LogOut}
            danger
            onSelect={() => {
              signOut();
              close();
              router.replace("/login");
            }}
          >
            Sair
          </MenuItem>
        </>
      )}
    </Dropdown>
  );
}
