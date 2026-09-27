"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type Content = React.ReactNode | ((close: () => void) => React.ReactNode);

/**
 * Click-to-open panel rendered in a portal with fixed positioning, so menus inside scrolling
 * tables are never clipped. Closes on outside click, Escape, resize and page scroll.
 */
export function Dropdown({
  trigger,
  label,
  children,
  align = "end",
  width = 260,
  className,
  triggerClassName,
}: {
  trigger: React.ReactNode;
  label: string;
  children: Content;
  align?: "start" | "end";
  width?: number;
  className?: string;
  triggerClassName?: string;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const close = useCallback(() => setPos(null), []);

  const toggle = () => {
    if (pos) return close();
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = align === "end" ? rect.right - width : rect.left;
    setPos({ top: rect.bottom + 8, left: Math.min(Math.max(8, left), window.innerWidth - width - 8) });
  };

  useEffect(() => {
    if (!pos) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        triggerRef.current?.focus();
      }
    };
    const onScroll = (event: Event) => {
      if (!panelRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [pos, close]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={!!pos}
        onClick={toggle}
        className={cn("outline-none focus-visible:ring-2 focus-visible:ring-primary/40", triggerClassName)}
      >
        {trigger}
      </button>
      {pos &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            className={cn("fixed z-[90] rounded-xl border border-line bg-white p-1.5 shadow-pop animate-fade-in", className)}
            style={{ top: pos.top, left: pos.left, width }}
          >
            {typeof children === "function" ? children(close) : children}
          </div>,
          document.body,
        )}
    </>
  );
}

const itemClass =
  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] text-ink transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none";

export function MenuItem({
  icon: Icon,
  children,
  onSelect,
  href,
  danger,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  onSelect?: () => void;
  href?: string;
  danger?: boolean;
}) {
  const content = (
    <>
      {Icon && <Icon className={cn("size-4 shrink-0", danger ? "text-critical" : "text-ink-3")} />}
      <span className={cn("min-w-0 flex-1", danger && "text-critical")}>{children}</span>
    </>
  );
  return href ? (
    <Link role="menuitem" href={href} onClick={onSelect} className={itemClass}>
      {content}
    </Link>
  ) : (
    <button role="menuitem" type="button" onClick={onSelect} className={itemClass}>
      {content}
    </button>
  );
}

export function MenuDivider() {
  return <div className="my-1.5 h-px bg-line" />;
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-2.5 pt-1.5 pb-1 text-[11.5px] font-semibold tracking-wide text-ink-3 uppercase">{children}</div>;
}
