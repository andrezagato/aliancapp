"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Modal via portal no <body>. Importante: renderizar via portal escapa de
 * qualquer ancestral com `transform` (ex.: `.animate-fade-in`, cujo translateY
 * final vira um containing block) — sem isso o `position: fixed` se ancora no
 * ancestral e o modal "cai" no meio da página longa em vez do centro da tela.
 */
export function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
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
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div className="w-full max-w-[420px]" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
