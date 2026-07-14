"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";

/**
 * Toast único, calmo: sobe embaixo, fica ~2.6s e some (keyframe `toast`).
 * Feedback tátil pro que antes era um `router.refresh()` silencioso.
 */
type ToastContextValue = { showToast: (message: string) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast precisa estar dentro de <ToastProvider>.");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMounted(true), []);

  const showToast = useCallback((message: string) => {
    // novo id → React remonta o elemento e a animação toca de novo
    setToast((prev) => ({ id: (prev?.id ?? 0) + 1, message }));
  }, []);

  useEffect(() => {
    if (!toast) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2600);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [toast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {mounted && toast
        ? createPortal(
            <div
              key={toast.id}
              role="status"
              aria-live="polite"
              className="animate-toast pointer-events-none fixed left-1/2 z-[95] flex max-w-[320px] items-center gap-2.5 rounded-2xl bg-foreground px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lift"
              style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.75rem)" }}
            >
              <span className="grid size-[22px] shrink-0 place-items-center rounded-full bg-success">
                <Check className="size-3.5 text-white" strokeWidth={3} />
              </span>
              {toast.message}
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  );
}
