"use client";

import { Clock, CheckCheck } from "lucide-react";
import type { MyAssignment } from "@/lib/data";
import { fmtTime } from "@/lib/format";
import { DrawnCheck } from "./drawn-check";

/**
 * Card "É hoje": só aparece quando há escala no dia. Adapta o rodapé ao
 * estado — confirmar (se ainda convidado), check-in (se confirmado) ou a
 * faixa verde "Presente" (depois do check-in).
 */
export function TodayCard({
  a,
  onConfirm,
  onCancel,
  onCheckin,
  checkinEmVoo = false,
}: {
  a: MyAssignment;
  onConfirm: () => void;
  onCancel: () => void;
  onCheckin: () => void;
  /** O check-in desta escala está no ar (GPS + servidor). Trava o botão e diz
   *  na letra que ALGO está acontecendo — sem isto a tela ficava idêntica por
   *  até 6s e a pessoa tocava de novo. Opcional pra não quebrar chamador antigo. */
  checkinEmVoo?: boolean;
}) {
  const pending = a.status === "convidado";
  const canCheckin = (a.status === "confirmado" || a.status === "presente") && !a.checkedIn;

  return (
    <div className="animate-fade-up rounded-[22px] border border-accent/50 bg-gradient-to-br from-accent/25 to-accent/45 p-4 shadow-soft">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-accent-foreground">
          <Clock className="size-3" strokeWidth={2.4} /> É hoje
        </span>
        <span className="text-[12.5px] font-semibold text-accent-foreground/80">
          {fmtTime(a.startsAt)}
          {a.location ? ` · ${a.location}` : ""}
        </span>
      </div>
      <h2 className="mt-2.5 font-display text-xl font-bold leading-tight text-foreground">{a.eventTitle}</h2>
      <p className="text-[13.5px] text-accent-foreground/80">
        {a.teamName} · {a.positionName}
      </p>
      {a.callAt && !a.checkedIn ? (
        <p className="mt-1 text-[13px] font-bold text-primary">⏰ Equipe chega às {fmtTime(a.callAt)}</p>
      ) : null}

      <div className="mt-3.5">
        {a.checkedIn ? (
          <div className="flex h-[46px] animate-pop items-center justify-center gap-2 rounded-[14px] bg-success/15 text-[15px] font-extrabold text-success-ink">
            <DrawnCheck className="size-[19px]" /> Presente
          </div>
        ) : canCheckin ? (
          <div className="space-y-2">
            <button
              onClick={onCheckin}
              disabled={checkinEmVoo}
              aria-busy={checkinEmVoo}
              className="press flex h-[46px] w-full items-center justify-center gap-2 rounded-[14px] bg-primary text-[15px] font-extrabold text-primary-foreground disabled:opacity-60"
            >
              <CheckCheck className="size-[18px]" strokeWidth={2.2} />
              {/* O texto muda junto com o `disabled`: alvo apagado sem palavra
                  nova lê como "travou", e quem acha que travou toca de novo —
                  que é justamente o que a trava veio impedir. E "Buscando sua
                  localização" nomeia a espera REAL: na primeira vez o iOS ainda
                  vai abrir o alerta de permissão por cima, e sem esse texto o
                  alerta chega sem contexto nenhum. */}
              {checkinEmVoo ? "Buscando sua localização…" : "Fazer check-in"}
            </button>
            {a.status === "confirmado" ? (
              <button
                onClick={onCancel}
                className="press-sm w-full text-center text-[12.5px] font-semibold text-accent-foreground/70 underline underline-offset-2"
              >
                Surgiu um imprevisto? Não vou poder mais
              </button>
            ) : null}
          </div>
        ) : pending ? (
          <div className="flex gap-2.5">
            <button
              onClick={onConfirm}
              className="press flex h-[46px] flex-1 items-center justify-center gap-2 rounded-[14px] bg-primary text-[15px] font-extrabold text-primary-foreground"
            >
              Confirmar
            </button>
            <button
              onClick={onCancel}
              className="press h-[46px] rounded-[14px] border border-primary/20 bg-card px-5 text-sm font-bold text-primary"
            >
              Não posso
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
