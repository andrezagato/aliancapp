import { ChevronRight } from "lucide-react";
import { TeamReview } from "@/components/team-review";
import { AbrirEscala } from "@/components/event/abrir-escala";
import { fmtWeekdayShort, fmtDayMonthShort } from "@/lib/format";
import type { EventListItem } from "@/lib/data";

/**
 * Seção recolhível "Finalizados": cultos já encerrados (histórico recente).
 * Cada linha abre a escala do culto; quem lidera/admin tem o botão "Revisar"
 * (avaliação da equipe). Vive na aba Escalas.
 */
export function FinalizadosSection({ events, canReview }: { events: EventListItem[]; canReview: boolean }) {
  if (events.length === 0) return null;
  return (
    <details className="group overflow-hidden rounded-2xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-muted-foreground [&::-webkit-details-marker]:hidden">
        <span>Finalizados · {events.length}</span>
        <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
      </summary>
      <div className="flex flex-col gap-1 border-t border-border p-2">
        {events.map((e) => (
          <div key={e.id} className="flex items-center gap-1 rounded-xl px-1 hover:bg-muted">
            <AbrirEscala
              eventId={e.id}
              className="flex min-w-0 flex-1 items-center justify-between gap-3 px-2 py-2.5"
            >
              <span className="min-w-0 truncate text-sm font-medium text-foreground">{e.title}</span>
              <span className="shrink-0 text-[11px] capitalize text-muted-foreground">
                {fmtWeekdayShort(e.starts_at)} · {fmtDayMonthShort(e.starts_at)}
              </span>
            </AbrirEscala>
            {canReview ? (
              <TeamReview
                eventId={e.id}
                triggerClassName="press-sm shrink-0 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-[12px] font-bold text-primary"
                trigger="Revisar"
              />
            ) : null}
          </div>
        ))}
      </div>
    </details>
  );
}
