"use client";

import { useState } from "react";
import { MonthCalendar } from "@/components/month-calendar";
import { Modal } from "@/components/modal";
import { CoverageBadge } from "@/components/coverage-badge";
import { EventEscalaModal } from "@/components/event/event-escala-modal";
import { ConfirmationAlert } from "@/components/event/confirmation-alert";
import { fmtTime, fmtEventWhen } from "@/lib/format";
import type { EventListItem } from "@/lib/data";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Home do líder: calendário com os dias em que a equipe serve. Tocar num dia
 * abre a escala da equipe naquele evento (editável ali mesmo, via EventEscalaModal).
 * Se o dia tem mais de um evento, escolhe qual primeiro.
 */
export function LeaderMonthBoard({
  year,
  month,
  calendarEvents,
  calendarDayISO,
  todayISO,
}: {
  year: number;
  month: number;
  calendarEvents: EventListItem[];
  calendarDayISO: Record<string, string>;
  todayISO: string;
}) {
  const [dayPick, setDayPick] = useState<{ n: number; events: EventListItem[] } | null>(null);
  const [openEvent, setOpenEvent] = useState<EventListItem | null>(null);

  const pick = (evs: EventListItem[], n: number) => {
    if (evs.length === 1) setOpenEvent(evs[0]);
    else setDayPick({ n, events: evs });
  };

  const nowIso = new Date().toISOString();
  const pendingSoon = calendarEvents
    .filter((ev) => ev.starts_at >= nowIso && ev.assignedTotal - ev.confirmedTotal > 0)
    .sort((a, b) => (a.starts_at < b.starts_at ? -1 : 1))
    .slice(0, 3);

  return (
    <>
      {pendingSoon.length > 0 ? (
        <section className="space-y-2">
          {pendingSoon.map((ev) => (
            <ConfirmationAlert
              key={ev.id}
              eventId={ev.id}
              startsAt={ev.starts_at}
              pending={ev.assignedTotal - ev.confirmedTotal}
              context={`${ev.title} · ${fmtEventWhen(ev.starts_at)}`}
            />
          ))}
        </section>
      ) : null}

      <section>
        <h3 className="mb-2 px-1 text-base font-semibold">Dias que sua equipe serve</h3>
        <MonthCalendar
          year={year}
          month={month}
          events={calendarEvents}
          eventDayISO={calendarDayISO}
          todayISO={todayISO}
          onDayClick={(n, evs) => pick(evs, n)}
        />
        <p className="mt-2 px-1 text-xs text-muted-foreground">Toque num dia marcado pra ver e ajustar a escala.</p>
      </section>

      {/* Passo 1: escolher qual evento do dia (quando há mais de um) */}
      <Modal
        open={!!dayPick && !openEvent}
        onClose={() => setDayPick(null)}
        sheet
        title={dayPick ? `Dia ${pad(dayPick.n)}/${pad(month)}` : ""}
      >
        <div className="space-y-2 pt-1">
          {dayPick?.events.map((ev) => (
            <button
              key={ev.id}
              type="button"
              onClick={() => {
                setOpenEvent(ev);
                setDayPick(null);
              }}
              className="flex w-full items-center justify-between gap-2 rounded-2xl border border-border p-3.5 text-left hover:bg-muted/40"
            >
              <span className="min-w-0">
                <span className="block font-semibold">{ev.title}</span>
                <span className="text-sm text-muted-foreground">{fmtTime(ev.starts_at)}</span>
              </span>
              <CoverageBadge tone={ev.overallTone} label={`${ev.confirmedTotal}/${ev.neededTotal} confirmados`} />
            </button>
          ))}
        </div>
      </Modal>

      {/* Passo 2: a escala do evento — editável */}
      <EventEscalaModal event={openEvent} revalidateKey={calendarEvents} onClose={() => setOpenEvent(null)} />
    </>
  );
}
