"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, ChevronRight, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CoverageBadge } from "@/components/coverage-badge";
import { EventEscalaModal } from "@/components/event/event-escala-modal";
import { fmtEventDate, fmtTime } from "@/lib/format";
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
            <>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{ev.title}</p>
                  <p className="text-sm capitalize text-muted-foreground">{fmtEventDate(ev.starts_at)}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="size-3" /> {fmtTime(ev.starts_at)}
                    </span>
                    {ev.location ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3" /> {ev.location}
                      </span>
                    ) : null}
                  </p>
                </div>
                <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground" />
              </div>
              {ev.teams.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {ev.teams.map((t) => (
                    <CoverageBadge key={t.teamId} tone={t.tone} label={`${t.name} ${t.assigned}/${t.needed}`} />
                  ))}
                </div>
              ) : null}
            </>
          );
          return (
            <Card key={ev.id}>
              {asModal ? (
                <button type="button" onClick={() => setOpenEvent(ev)} className="press-sm block w-full p-4 text-left">
                  {body}
                </button>
              ) : (
                <Link href={`/escalas/${ev.id}`} className="press-sm block p-4">
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
