"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { definirCallTime } from "@/lib/actions";

/**
 * Controle do admin pra definir/limpar o call time (chegada da equipe) de um
 * evento. `date` = data do evento (YYYY-MM-DD, SP); `current` = "HH:mm" ou "".
 */
export function CallTimeControl({ eventId, date, current }: { eventId: string; date: string; current: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [time, setTime] = useState(current);
  const [busy, start] = useTransition();

  // Salva sozinho ao escolher a hora (sem botão).
  const onPick = (v: string) => {
    setTime(v);
    start(async () => {
      const r = await definirCallTime(eventId, date, v);
      if (r.ok) {
        showToast(v ? "Chegada da equipe salva." : "Horário de chegada removido.");
        router.refresh();
      } else {
        showToast(r.error);
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Clock className="size-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">Equipe chega:</span>
      <input
        type="time"
        value={time}
        disabled={busy}
        onChange={(e) => onPick(e.target.value)}
        className="rounded-[10px] border border-border bg-card px-2.5 py-1.5 text-sm outline-none focus:border-primary disabled:opacity-60"
      />
    </div>
  );
}
