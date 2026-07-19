"use client";

import { useState } from "react";
import Link from "next/link";
import { MonthCalendar } from "@/components/month-calendar";
import { Modal } from "@/components/modal";
import { CoverageBadge } from "@/components/coverage-badge";
import { fmtTime } from "@/lib/format";
import type { EventListItem } from "@/lib/data";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Calendário do mês pro admin: toque num dia abre um modal com os eventos
 * daquele dia (responsável + cobertura) — menos página carregando. Cada evento
 * leva pra escala completa.
 */
export function AdminMonthOverview({
  year,
  month,
  events,
  eventDayISO,
  todayISO,
}: {
  year: number;
  month: number;
  events: EventListItem[];
  eventDayISO: Record<string, string>;
  todayISO: string;
}) {
  const [day, setDay] = useState<{ n: number; events: EventListItem[] } | null>(null);

  return (
    <>
      <MonthCalendar
        year={year}
        month={month}
        events={events}
        eventDayISO={eventDayISO}
        todayISO={todayISO}
        onDayClick={(n, evs) => setDay({ n, events: evs })}
      />

      <Modal
        open={!!day}
        onClose={() => setDay(null)}
        sheet
        title={day ? `Dia ${pad(day.n)}/${pad(month)}` : ""}
      >
        <div className="space-y-3 pt-1">
          {day?.events.map((ev) => (
            <div key={ev.id} className="rounded-2xl border border-border p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{ev.title}</p>
                <span className="text-sm text-muted-foreground">{fmtTime(ev.starts_at)}</span>
              </div>
              <p className="mt-0.5 text-sm">
                {ev.responsibleName ? (
                  <span className="text-muted-foreground">Responsável: {ev.responsibleName}</span>
                ) : (
                  <span className="font-medium text-warning">Sem responsável ainda</span>
                )}
              </p>
              {ev.teams.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {ev.teams.map((t) => (
                    <CoverageBadge key={t.teamId} tone={t.tone} label={`${t.name} ${t.confirmed}/${t.needed}`} />
                  ))}
                </div>
              ) : null}
              <Link
                href={`/escalas/${ev.id}`}
                className="mt-3 inline-block text-sm font-semibold text-primary hover:underline"
              >
                Abrir escala →
              </Link>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
