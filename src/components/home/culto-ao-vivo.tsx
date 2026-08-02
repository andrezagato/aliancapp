"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * "O culto está rolando agora" — aparece na Home de todo mundo enquanto o
 * roteiro estiver em andamento (iniciado e não encerrado).
 *
 * Quem está servindo abre o app no meio do culto pra saber em que ponto a
 * ordem está; antes disso não havia sinal nenhum na Home — era preciso lembrar
 * de ir na aba Roteiro. O relógio aqui é o mesmo do roteiro (tempo desde o
 * início), pra pessoa saber de cara se chegou atrasada.
 *
 * Não usa vinho de propósito: a Home já tem o herói vinho, e a Regra do Vinho
 * Raro (DESIGN.md) permite um bloco por tela. Ao vivo fala a mesma língua do
 * roteiro — telha com o ponto pulsando.
 */
export function CultoAoVivo({ eventId, title, startedAt }: { eventId: string; title: string; startedAt: string }) {
  const inicio = new Date(startedAt).getTime();
  // null no primeiro render: o relógio do servidor e o do celular não batem, e
  // renderizar tempo no SSR daria mismatch de hidratação.
  const [agora, setAgora] = useState<number | null>(null);

  useEffect(() => {
    setAgora(Date.now());
    const t = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const decorrido = agora ? Math.max(0, agora - inicio) : 0;
  const h = Math.floor(decorrido / 3_600_000);
  const m = Math.floor((decorrido % 3_600_000) / 60_000);
  const s = Math.floor((decorrido % 60_000) / 1000);
  const relogio = h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;

  return (
    <Link
      href={`/cronograma?ev=${eventId}`}
      className="press flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 shadow-soft"
    >
      <span className="size-2.5 shrink-0 animate-pulse rounded-full bg-destructive" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-destructive-ink">Culto ao vivo</p>
        <p className="truncate font-display text-[17px] font-extrabold leading-tight">{title}</p>
        <p className="text-[12.5px] text-muted-foreground">Toque para acompanhar o roteiro</p>
      </div>
      <span className="shrink-0 font-display text-2xl font-extrabold tabular-nums text-destructive-ink">
        {agora ? relogio : "—"}
      </span>
      <ChevronRight className="size-5 shrink-0 text-destructive-ink/60" />
    </Link>
  );
}
