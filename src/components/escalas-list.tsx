"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CoverageBadge } from "@/components/coverage-badge";
import { EventEscalaModal } from "@/components/event/event-escala-modal";
import { fmtWeekdayShort, fmtDayMonthShort, fmtTime } from "@/lib/format";
import type { EventListItem } from "@/lib/data";

/**
 * Lista de eventos da aba Escalas. `asModal` (líder) → tocar abre a escala da
 * equipe num bottom-sheet editável; senão → navega pra escala completa.
 */
export function EscalasList({ events, asModal }: { events: EventListItem[]; asModal: boolean }) {
  const [openEvent, setOpenEvent] = useState<EventListItem | null>(null);

  return (
    <>
      <div className="space-y-3">
        {events.map((ev) => {
          const body = (
            <div className="flex items-center gap-3">
              <div className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-muted py-1.5 text-center">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">{fmtWeekdayShort(ev.starts_at)}</span>
                <span className="font-display text-lg font-extrabold leading-none text-primary">
                  {fmtDayMonthShort(ev.starts_at).split(" ")[0]}
                </span>
                <span className="text-[10px] tabular-nums text-muted-foreground">{fmtTime(ev.starts_at)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold leading-tight">{ev.title}</p>
                {ev.teams.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {ev.teams.map((t) => (
                      <CoverageBadge key={t.teamId} tone={t.tone} label={`${t.name} ${t.assigned}/${t.needed}`} />
                    ))}
                  </div>
                ) : null}
                {ev.location ? (
                  <p className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-[12px] text-muted-foreground">
                    <MapPin className="size-3 shrink-0" /> {ev.location}
                  </p>
                ) : null}
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground/60" />
            </div>
          );
          return (
            <Card key={ev.id}>
              {asModal ? (
                <button type="button" onClick={() => setOpenEvent(ev)} className="press-sm block w-full p-3 text-left">
                  {body}
                </button>
              ) : (
                <Link href={`/escalas/${ev.id}`} className="press-sm block p-3">
                  {body}
                </Link>
              )}
            </Card>
          );
        })}
      </div>
      {asModal ? (
        <EventEscalaModal event={openEvent} revalidateKey={events} onClose={() => setOpenEvent(null)} />
      ) : null}
    </>
  );
}
