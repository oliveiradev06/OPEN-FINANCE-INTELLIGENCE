"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = 560,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  width?: number;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[80]">
      <button aria-label="Fechar painel" className="absolute inset-0 bg-[#0b1f3a]/35 animate-fade-in" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="absolute top-0 right-0 flex h-full max-w-full flex-col border-l border-line bg-white shadow-pop outline-none animate-slide-in"
        style={{ width }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div className="min-w-0">
            {title}
            {subtitle && <div className="mt-1 text-[12.5px] text-ink-3">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-ink-3 hover:bg-surface-3 hover:text-ink" aria-label="Fechar">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
