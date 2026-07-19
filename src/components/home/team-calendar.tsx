"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { MonthCalendar } from "@/components/month-calendar";
import { Modal } from "@/components/modal";
import { CoverageBadge } from "@/components/coverage-badge";
import { EventEscalaModal } from "@/components/event/event-escala-modal";
import { SugerirEventoForm, type TeamOption } from "@/components/event-request-controls";
import { fmtTime } from "@/lib/format";
import type { EventListItem } from "@/lib/data";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Calendário do mês onde clicar em QUALQUER dia abre um modal: lista os eventos
 * daquele dia (abre a escala pra ajustar) e sempre oferece "pedir evento nesse
 * dia" (com a data já preenchida). Usado na home do líder e na visão de mês.
 */
export function TeamCalendar({
  year,
  month,
  events,
  eventDayISO,
  todayISO,
  teams,
  hint,
  canRequest = true,
}: {
  year: number;
  month: number;
  events: EventListItem[];
  eventDayISO: Record<string, string>;
  todayISO: string;
  teams: TeamOption[];
  hint?: string;
  canRequest?: boolean;
}) {
  const router = useRouter();
  const [day, setDay] = useState<{ n: number; iso: string; events: EventListItem[] } | null>(null);
  const [openEvent, setOpenEvent] = useState<EventListItem | null>(null);
  const [showForm, setShowForm] = useState(false);

  const openDay = (n: number, evs: EventListItem[]) => {
    setDay({ n, iso: `${year}-${pad(month)}-${pad(n)}`, events: evs });
    setShowForm(false);
  };

  return (
    <>
      <MonthCalendar
        year={year}
        month={month}
        events={events}
        eventDayISO={eventDayISO}
        todayISO={todayISO}
        onDayClick={openDay}
      />
      {hint ? <p className="mt-2 px-1 text-xs text-muted-foreground">{hint}</p> : null}

      <Modal
        open={!!day && !openEvent}
        onClose={() => setDay(null)}
        sheet
        title={day ? `Dia ${pad(day.n)}/${pad(month)}` : ""}
      >
        <div className="space-y-2 pt-1">
          {day?.events.map((ev) => (
            <button
              key={ev.id}
              type="button"
              onClick={() => {
                setOpenEvent(ev);
                setDay(null);
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

          {day && day.events.length === 0 ? (
            <p className="px-1 py-2 text-sm text-muted-foreground">Nenhum evento nesse dia ainda.</p>
          ) : null}

          {canRequest ? (
            showForm && day ? (
              <div className="pt-1">
                <SugerirEventoForm
                  teams={teams}
                  initialDate={day.iso}
                  onDone={() => {
                    setDay(null);
                    router.refresh();
                  }}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="press mt-1 flex w-full items-center justify-center gap-2 rounded-[14px] border border-dashed border-primary/40 py-3 text-sm font-bold text-primary"
              >
                <CalendarPlus className="size-4" /> Pedir evento nesse dia
              </button>
            )
          ) : null}
        </div>
      </Modal>

      <EventEscalaModal event={openEvent} revalidateKey={events} onClose={() => setOpenEvent(null)} />
    </>
  );
}
