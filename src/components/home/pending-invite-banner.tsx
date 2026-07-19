"use client";

import { BellRing } from "lucide-react";
import type { MyAssignment } from "@/lib/data";
import { fmtEventWhen, fmtTime } from "@/lib/format";

/**
 * Banner de convites de escala aguardando resposta. Fica no topo da home do
 * voluntário, em alto contraste, com um único botão "Responder" por convite —
 * o objetivo é que aceitar/recusar uma escala seja impossível de ignorar.
 */
export function PendingInviteBanner({
  pending,
  onRespond,
}: {
  pending: MyAssignment[];
  onRespond: (a: MyAssignment) => void;
}) {
  if (pending.length === 0) return null;

  return (
    <section
      role="alert"
      className="relative animate-fade-up overflow-hidden rounded-[22px] border border-accent/60 bg-gradient-to-br from-accent/30 to-accent/55 p-4 shadow-lift"
    >
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 shrink-0 animate-pulse place-items-center rounded-full bg-primary text-primary-foreground">
          <BellRing className="size-[18px]" strokeWidth={2.4} />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-extrabold leading-tight text-foreground">
            {pending.length > 1 ? `${pending.length} escalas esperando você` : "Você está escalado!"}
          </h2>
          <p className="text-[13px] font-medium text-accent-foreground/80">
            Confirme sua presença — o líder está contando com você.
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {pending.map((a) => (
          <div
            key={a.assignmentId}
            className="flex items-center justify-between gap-3 rounded-[15px] bg-card px-3.5 py-3 shadow-soft"
          >
            <div className="min-w-0">
              <p className="truncate font-bold text-foreground">{a.eventTitle}</p>
              <p className="truncate text-[12.5px] capitalize text-muted-foreground">
                {fmtEventWhen(a.startsAt)} · {a.teamName}
              </p>
              {a.callAt ? (
                <p className="truncate text-[12px] font-bold text-primary">Chega às {fmtTime(a.callAt)}</p>
              ) : null}
            </div>
            <button
              onClick={() => onRespond(a)}
              className="press h-11 shrink-0 rounded-[13px] bg-primary px-5 text-sm font-extrabold text-primary-foreground"
            >
              Responder
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
