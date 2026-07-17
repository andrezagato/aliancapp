"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Bottom sheet (mobile) / diálogo centrado (desktop) via portal no <body>.
 * O portal escapa de qualquer ancestral com `transform` (ex.: `.animate-*`,
 * cujo transform final vira containing block) — sem isso o `position: fixed`
 * se ancora no ancestral e o sheet "cai" no meio da página em vez de colar
 * embaixo. Sobe com mola (`animate-sheet`) sobre um véu que faz fade
 * (`animate-scrim`). Passe `sheet` para o visual "Aconchego" (pega dourada +
 * cantos arredondados + título serif); sem ele, é só um contêiner com mola.
 *
 * No modo `sheet` dá pra fechar arrastando a alça pra baixo (swipe-down) além
 * de Escape, clique no véu e o botão × — menos página, mais fluidez.
 */
const CLOSE_DY = 110; // arrastar a alça além disso fecha

export function Modal({
  open,
  onClose,
  children,
  sheet = false,
  title,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  sheet?: boolean;
  title?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [dy, setDy] = useState(0);
  const [settling, setSettling] = useState(false);
  const drag = useRef<{ y: number } | null>(null);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const onDown = (e: React.PointerEvent) => {
    drag.current = { y: e.clientY };
    setSettling(false);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setDy(Math.max(0, e.clientY - drag.current.y));
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const ddy = e.clientY - d.y;
    setSettling(true);
    if (ddy > CLOSE_DY) onClose();
    else setDy(0);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto sm:items-center"
      onClick={onClose}
    >
      <div
        className="animate-scrim absolute inset-0 bg-[hsl(var(--foreground)/0.42)]"
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "animate-sheet relative w-full",
          sheet
            ? "max-h-[88dvh] max-w-[480px] overflow-y-auto rounded-t-[26px] bg-background px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-2 shadow-[0_-12px_40px_rgba(58,42,40,0.2)] sm:rounded-[26px] sm:pb-6"
            : "m-4 max-w-[420px]",
          settling && "transition-transform duration-300 ease-out",
        )}
        style={sheet && dy ? { transform: `translateY(${dy}px)` } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {sheet ? (
          <>
            <div
              className="-mx-5 -mt-2 touch-none px-5 pb-1 pt-2"
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            >
              <div className="mx-auto mb-3 mt-1.5 h-[5px] w-10 cursor-grab rounded-full bg-border active:cursor-grabbing" />
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            >
              <X className="size-5" />
            </button>
            {title ? (
              <h3 className="font-display text-[22px] font-extrabold leading-tight text-foreground">
                {title}
              </h3>
            ) : null}
          </>
        ) : null}
        {children}
      </div>
    </div>,
    document.body,
  );
}
