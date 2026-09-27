"use client";

import {
  Calculator,
  ChartColumnBig,
  FileText,
  House,
  Landmark,
  Lightbulb,
  Settings,
  Target,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BuildingArt } from "./BuildingArt";
import { Brand } from "./Logo";

export const NAV = [
  { href: "/", label: "Início", icon: House },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/oportunidades", label: "Oportunidades", icon: Target },
  { href: "/insights", label: "Insights", icon: Lightbulb },
  { href: "/instituicoes", label: "Instituições", icon: Landmark },
  { href: "/analytics", label: "Análises", icon: ChartColumnBig },
  { href: "/relatorios", label: "Relatórios", icon: FileText },
  { href: "/simulador", label: "Simulador", icon: Calculator },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <aside
      className={cn(
        "sticky top-0 h-screen w-[244px] shrink-0 flex-col overflow-hidden bg-gradient-to-b from-[#0b2339] via-[#0d2c48] to-[#0b2643]",
        className,
      )}
    >
      <Link href="/" className="relative z-10 px-6 pt-7 pb-8" aria-label="OpenFinance Intelligence — início">
        <Brand />
      </Link>

      <nav className="relative z-10 flex flex-col gap-1 px-4" aria-label="Navegação principal">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-11 items-center gap-3 rounded-lg px-3.5 text-[14px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/40",
                active
                  ? "bg-gradient-to-r from-[#1c5288] to-[#174676] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.07)]"
                  : "text-nav-ink hover:bg-white/[0.06] hover:text-white",
              )}
            >
              {active && <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-[#3ddba8]" />}
              <Icon className={cn("size-[19px]", active ? "text-white" : "text-[#a9bdd8]")} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="relative mt-auto h-[210px] shrink-0">
        <BuildingArt variant="sidebar" className="absolute inset-0 h-full w-full opacity-70" />
        <p className="absolute right-5 bottom-4 left-6 text-[11px] leading-snug text-white/55">
          Ambiente de demonstração · dados 100% sintéticos
        </p>
      </div>
    </aside>
  );
}
