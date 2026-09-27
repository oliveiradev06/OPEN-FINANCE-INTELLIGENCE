"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // The mobile menu belongs to the route it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;

  if (pathname === "/login") return <>{children}</>;

  return (
    <div className="flex min-h-screen">
      <Sidebar className="hidden lg:flex" />
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button aria-label="Fechar menu" className="absolute inset-0 bg-[#0b1f3a]/50" onClick={() => setOpenOn(null)} />
          <Sidebar className="relative z-10 flex h-full animate-fade-in" />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          leading={
            <button
              aria-label="Abrir menu"
              onClick={() => setOpenOn(pathname)}
              className="rounded-md p-2 text-ink-2 hover:bg-white/80 lg:hidden"
            >
              <Menu className="size-5" />
            </button>
          }
        />
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 pt-6 pb-16 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
