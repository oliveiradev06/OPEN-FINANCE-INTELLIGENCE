"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * Hover/focus popover rendered in a portal with fixed positioning, so it is never clipped
 * by scrolling tables. Keyboard focus shows the same content as hover.
 */
export function HoverPopover({
  trigger,
  children,
  width = 320,
  className,
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  width?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const open = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 8);
    const below = rect.bottom + 8;
    const top = below + 260 > window.innerHeight ? Math.max(8, rect.top - 8 - 260) : below;
    setPos({ top, left });
  }, [width]);

  const close = useCallback(() => {
    closeTimer.current = setTimeout(() => setPos(null), 80);
  }, []);

  useEffect(() => {
    if (!pos) return;
    const hide = () => setPos(null);
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, [pos]);

  return (
    <>
      <span
        ref={ref}
        tabIndex={0}
        aria-describedby={pos ? id : undefined}
        onMouseEnter={open}
        onMouseLeave={close}
        onFocus={open}
        onBlur={close}
        className="inline-flex cursor-help rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {trigger}
      </span>
      {pos &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            onMouseEnter={() => closeTimer.current && clearTimeout(closeTimer.current)}
            onMouseLeave={close}
            className={cn("fixed z-[100] rounded-xl border border-line bg-white p-4 text-left shadow-pop animate-fade-in", className)}
            style={{ top: pos.top, left: pos.left, width }}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
