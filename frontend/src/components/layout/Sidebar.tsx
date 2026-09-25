"use client";

import {
  ChartColumn,
  Database,
  Landmark,
  LayoutDashboard,
  Lightbulb,
  Settings,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMeta } from "@/lib/hooks";
import { initials } from "@/lib/format";
import { setRole, useRole } from "@/lib/role";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { LogoMark } from "./Logo";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/oportunidades", label: "Oportunidades", icon: Target },
  { href: "/insights", label: "Insights", icon: Lightbulb },
  { href: "/instituicoes", label: "Instituições", icon: Landmark },
  { href: "/analytics", label: "Analytics", icon: ChartColumn },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

const ROLE_OPTIONS: { key: Role; label: string }[] = [
  { key: "analista", label: "Analista" },
  { key: "coordenador", label: "Coordenador" },
  { key: "auditor", label: "Auditor" },
];

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const role = useRole();
  const { data: meta } = useMeta();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const name = meta?.analyst.name ?? "Analista";

  return (
    <aside
      className={cn(
        "sticky top-0 h-screen w-[248px] shrink-0 flex-col border-r border-line bg-[#080d18]",
        className,
      )}
    >
      <Link href="/" className="flex items-center gap-3 px-5 pt-6 pb-7">
        <LogoMark />
        <div className="leading-tight">
          <div className="text-[13px] font-semibold tracking-tight text-ink">Open Finance</div>
          <div className="text-[11px] font-medium tracking-[0.18em] text-accent-soft uppercase">Intelligence</div>
        </div>
      </Link>

      <nav className="flex flex-col gap-0.5 px-3" aria-label="Navegação principal">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors",
                active ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface hover:text-ink",
              )}
            >
              {active && <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-accent" />}
              <Icon className={cn("size-[18px]", active ? "text-accent-soft" : "text-ink-3 group-hover:text-ink-2")} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 p-3">
        <div className="rounded-lg border border-line bg-surface/60 p-3">
          <div className="flex items-center gap-2 text-[12px] font-medium text-ink-2">
            <Database className="size-3.5 text-warning" />
            Ambiente de demonstração
          </div>
          <p className="mt-1 text-[11.5px] leading-snug text-ink-3">
            Dados 100% sintéticos. Nenhum dado bancário real ou credencial é utilizado.
          </p>
        </div>

        <div className="rounded-lg border border-line bg-surface p-3">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-full bg-surface-3 text-[12px] font-semibold text-ink ring-1 ring-white/10">
              {initials(name)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium text-ink">{name}</div>
              <div className="flex items-center gap-1 text-[11.5px] text-ink-3">
                <ShieldCheck className="size-3" /> Inteligência Comercial
              </div>
            </div>
          </div>
          <label className="mt-3 block text-[11px] font-medium tracking-wide text-ink-3 uppercase" htmlFor="role">
            Perfil de acesso (simulado)
          </label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="mt-1 w-full rounded-md border border-line-strong bg-surface-2 px-2 py-1.5 text-[13px] text-ink outline-none focus:border-accent/60"
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </aside>
  );
}
