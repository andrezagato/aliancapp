"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, BellRing } from "lucide-react";
import { lembrarPendentes } from "@/lib/actions";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/**
 * Faixa de alerta pro líder: quantas confirmações ainda faltam num evento, com
 * um toque pra cutucar quem não respondeu. Fica âmbar normalmente e vermelha
 * quando o culto está a menos de 48h — aí a falta de confirmação vira risco real.
 */
export function ConfirmationAlert({
  eventId,
  startsAt,
  pending,
  context,
  className,
}: {
  eventId: string;
  startsAt: string;
  pending: number;
  /** Rótulo do evento (nome/quando) — usado quando o alerta aparece fora do contexto do próprio evento, ex.: home do líder. */
  context?: string;
  className?: string;
}) {
  const { showToast } = useToast();
  const [sent, setSent] = useState(false);
  const [busy, startTransition] = useTransition();

  const storageKey = `sirvo:lembrete:${eventId}`;
  // Trava por dia: se já lembrei hoje, não deixa disparar de novo (mesmo ao voltar à página).
  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey) === new Date().toISOString().slice(0, 10)) setSent(true);
    } catch {
      /* localStorage indisponível */
    }
  }, [storageKey]);

  if (pending <= 0) return null;

  const hoursTo = (new Date(startsAt).getTime() - Date.now()) / 36e5;
  const urgent = hoursTo <= 48;

  const remind = () => {
    startTransition(async () => {
      const r = await lembrarPendentes(eventId);
      if (r.ok) {
        setSent(true);
        try {
          localStorage.setItem(storageKey, new Date().toISOString().slice(0, 10));
        } catch {
          /* localStorage indisponível */
        }
        showToast(`Lembrete enviado a ${pending} ${pending > 1 ? "pessoas" : "pessoa"}.`);
      } else {
        showToast(r.error);
      }
    });
  };

  return (
    <div
      role="alert"
      className={cn(
        "flex items-center gap-3 rounded-[16px] border p-3.5",
        urgent
          ? "border-destructive/40 bg-destructive/10 text-destructive-ink"
          : "border-warning/45 bg-warning/12 text-warning-ink",
        className,
      )}
    >
      <AlertTriangle className="size-5 shrink-0" strokeWidth={2.2} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold leading-tight">
          Falta{pending > 1 ? "m" : ""} {pending} confirmaç{pending > 1 ? "ões" : "ão"}
        </p>
        <p className="truncate text-[12.5px] font-medium opacity-90">
          {context
            ? context
            : urgent
              ? "O culto está chegando — cutuque quem não respondeu."
              : "Ainda dá tempo de cobrar quem não respondeu."}
        </p>
      </div>
      <button
        onClick={remind}
        disabled={busy || sent}
        className={cn(
          "press-sm inline-flex shrink-0 items-center gap-1.5 rounded-[12px] bg-primary px-3 py-2 text-[13px] font-bold text-primary-foreground",
          (busy || sent) && "opacity-60",
        )}
      >
        <BellRing className="size-4" strokeWidth={2.4} />
        {sent ? "Enviado" : busy ? "Enviando…" : "Lembrar"}
      </button>
    </div>
  );
}
