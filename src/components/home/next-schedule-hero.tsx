"use client";

import type { MyAssignment } from "@/lib/data";
import { fmtEventWhen, fmtTime } from "@/lib/format";
import { DrawnCheck } from "./drawn-check";

/**
 * Herói "Sua próxima escala": card vinho com brilho dourado pulsando. Quando
 * ainda convidado, mostra Confirmar/Não posso; ao confirmar/recusar colapsa
 * para uma faixa de estado com "Ver escala ›".
 */
export function NextScheduleHero({
  a,
  onConfirm,
  onCancel,
  onOpen,
}: {
  a: MyAssignment;
  onConfirm: () => void;
  onCancel: () => void;
  onOpen: () => void;
}) {
  const pending = a.status === "convidado";
  const doneLabel = a.status === "recusado" ? "Você avisou que não vai" : "Presença confirmada";

  return (
    <div className="relative animate-fade-up overflow-hidden rounded-[26px] bg-gradient-to-br from-[hsl(349_72%_28%)] to-[hsl(349_69%_15%)] p-5 text-primary-foreground shadow-lift">
      <div
        className="pointer-events-none absolute -right-11 -top-11 size-44 animate-glow rounded-full"
        style={{ background: "radial-gradient(circle, hsl(var(--accent) / 0.42), transparent 68%)" }}
        aria-hidden
      />
      <div className="relative">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-accent">Sua próxima escala</p>
        <h2 className="mt-1 font-display text-[29px] font-extrabold leading-[1.04] text-white">{a.eventTitle}</h2>
        <p className="mt-1 text-sm capitalize text-primary-foreground/85">{fmtEventWhen(a.startsAt)}</p>
        {a.callAt ? (
          <p className="mt-0.5 text-[12.5px] font-bold text-accent">Equipe chega às {fmtTime(a.callAt)}</p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.13] px-2.5 py-1 text-[12.5px] font-medium">
            <span className="size-2 rounded-full" style={{ backgroundColor: a.teamColor || "hsl(var(--accent))" }} />
            {a.teamName}
          </span>
          <span className="rounded-full bg-white/[0.13] px-2.5 py-1 text-[12.5px] font-medium">{a.positionName}</span>
        </div>

        {pending ? (
          <div className="mt-4 flex gap-2.5">
            <button
              onClick={onConfirm}
              className="press flex h-[50px] flex-1 items-center justify-center gap-2 rounded-[15px] bg-accent text-[15.5px] font-extrabold text-accent-foreground shadow-[0_8px_20px_rgba(231,184,78,0.32)]"
            >
              <DrawnCheck className="size-[19px]" strokeWidth={2.6} /> Confirmar
            </button>
            <button
              onClick={onCancel}
              className="press h-[50px] rounded-[15px] border border-white/25 bg-white/[0.06] px-5 text-[14.5px] font-bold text-primary-foreground"
            >
              Não posso
            </button>
          </div>
        ) : (
          <div className="mt-4 animate-pop rounded-[15px] bg-white/10 px-4 py-3">
            <div className="flex items-center justify-between gap-2.5">
              <span className="inline-flex items-center gap-2.5 text-[15px] font-extrabold text-white">
                <span className="grid size-[26px] place-items-center rounded-full bg-accent text-accent-foreground">
                  <DrawnCheck className="size-[15px]" strokeWidth={3} />
                </span>
                {doneLabel}
              </span>
              <button onClick={onOpen} className="press-sm text-[13.5px] font-bold text-accent">
                Ver escala ›
              </button>
            </div>
            {a.status === "confirmado" ? (
              <button
                onClick={onCancel}
                className="press-sm mt-2 text-[12.5px] font-semibold text-primary-foreground/70 underline underline-offset-2"
              >
                Surgiu um imprevisto? Não vou poder mais
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
