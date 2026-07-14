"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * Bottom sheet (mobile) / diálogo centrado (desktop) via portal no <body>.
 * O portal escapa de qualquer ancestral com `transform` (ex.: `.animate-*`,
 * cujo transform final vira containing block) — sem isso o `position: fixed`
 * se ancora no ancestral e o sheet "cai" no meio da página em vez de colar
 * embaixo. Sobe com mola (`animate-sheet`) sobre um véu que faz fade
 * (`animate-scrim`). Passe `sheet` para o visual "Aconchego" (pega dourada +
 * cantos arredondados + título serif); sem ele, é só um contêiner com mola.
 */
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
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {sheet ? (
          <>
            <div className="mx-auto mb-3.5 mt-1.5 h-[5px] w-10 rounded-full bg-border" />
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
