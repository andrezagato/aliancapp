"use client";

import { MoreHorizontal } from "lucide-react";
import type { MyAssignment } from "@/lib/data";
import { fmtDayMonthShort, fmtTime, fmtWeekdayShort } from "@/lib/format";
import { DrawnCheck } from "./drawn-check";

/**
 * "Sua próxima escala" como uma PASSAGEM (Fase 6 do pós-audit) — data gigante
 * de um lado, evento/equipe do outro, perfuração tracejada entre os dois. É a
 * única pergunta do voluntário aqui ("quando eu sirvo e confirmo?"), então o
 * card é legítimo — o audit não pede menos card nesta tela, só esse desenho.
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
  const [, mesCurto] = fmtDayMonthShort(a.startsAt).split(" ");

  return (
    <div className="animate-fade-up overflow-hidden rounded-[22px] border border-border bg-card shadow-soft">
      <div className="flex">
        <div className="flex w-[92px] shrink-0 flex-col items-center justify-center gap-0.5 bg-primary/[0.06] py-4">
          <span className="text-[10.5px] font-extrabold uppercase tracking-wide text-muted-foreground">
            {fmtWeekdayShort(a.startsAt)}
          </span>
          <span className="font-display text-[52px] font-extrabold leading-none text-primary">
            {fmtDayMonthShort(a.startsAt).split(" ")[0]}
          </span>
          <span className="text-[11px] font-bold uppercase text-muted-foreground">{mesCurto}</span>
        </div>

        <div className="w-0 shrink-0 border-l-2 border-dashed border-border" aria-hidden />

        <div className="min-w-0 flex-1 p-4">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-muted-foreground">
            Sua próxima escala
          </p>
          <h2 className="mt-0.5 truncate font-display text-[17px] font-extrabold leading-tight text-foreground">
            {a.eventTitle}
          </h2>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-muted-foreground">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: a.teamColor || "hsl(var(--muted-foreground))" }}
            />
            {a.teamName} · {a.positionName}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-dashed border-border px-4 py-2.5 text-[12.5px]">
        <span>
          <span className="text-muted-foreground">Culto </span>
          <span className="font-bold text-foreground">{fmtTime(a.startsAt)}</span>
        </span>
        {a.callAt ? (
          <span>
            <span className="text-muted-foreground">Chegar </span>
            <span className="font-extrabold text-accent-foreground">{fmtTime(a.callAt)}</span>
          </span>
        ) : null}
        {a.location ? (
          <span className="min-w-0 truncate">
            <span className="text-muted-foreground">Local </span>
            <span className="font-semibold text-foreground">{a.location}</span>
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-2 p-3 pt-0">
        {pending ? (
          <>
            <button
              onClick={onConfirm}
              className="press flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[15px] bg-accent text-[15.5px] font-extrabold text-accent-foreground shadow-[0_8px_20px_rgba(231,184,78,0.32)]"
            >
              <DrawnCheck className="size-[19px]" strokeWidth={2.6} /> Confirmar presença
            </button>
            <button
              onClick={onCancel}
              aria-label="Mais opções"
              title="Mais opções"
              className="press-sm grid size-[52px] shrink-0 place-items-center rounded-[15px] border border-border text-muted-foreground"
            >
              <MoreHorizontal className="size-5" />
            </button>
          </>
        ) : (
          <div className="flex w-full items-center justify-between gap-2.5 rounded-[15px] bg-success/10 px-4 py-3">
            <span className="inline-flex items-center gap-2.5 text-[14.5px] font-extrabold text-success-ink">
              <span className="grid size-[26px] place-items-center rounded-full bg-success text-white">
                <DrawnCheck className="size-[15px]" strokeWidth={3} />
              </span>
              {doneLabel}
            </span>
            <button onClick={onOpen} className="press-sm shrink-0 text-[13.5px] font-bold text-primary">
              Ver escala ›
            </button>
          </div>
        )}
      </div>
      {!pending && a.status === "confirmado" ? (
        <button
          onClick={onCancel}
          className="press-sm block w-full pb-3 text-center text-[12.5px] font-semibold text-muted-foreground underline underline-offset-2"
        >
          Surgiu um imprevisto? Não vou poder mais
        </button>
      ) : null}
    </div>
  );
}
