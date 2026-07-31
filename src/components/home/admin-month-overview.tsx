"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, CalendarPlus } from "lucide-react";
import { MonthCalendar } from "@/components/month-calendar";
import { Modal } from "@/components/modal";
import { CoverageBadge } from "@/components/coverage-badge";
import { fmtTime } from "@/lib/format";
import type { EventListItem } from "@/lib/data";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Calendário do mês pro admin. Cabeçalho navega entre meses (‹ mês ›) e tem um
 * "+" discreto pra criar evento. Tocar num dia abre um modal com os eventos
 * daquele dia (responsável + cobertura) e sempre oferece criar um evento nesse
 * dia (com a data já preenchida). Menos página carregando.
 */
export function AdminMonthOverview({
  year,
  month,
  events,
  eventDayISO,
  todayISO,
  monthLabel,
  prevM,
  nextM,
}: {
  year: number;
  month: number;
  events: EventListItem[];
  eventDayISO: Record<string, string>;
  todayISO: string;
  monthLabel: string;
  prevM: string; // "YYYY-MM" do mês anterior
  nextM: string; // "YYYY-MM" do próximo mês
}) {
  const [day, setDay] = useState<{ n: number; events: EventListItem[] } | null>(null);
  const dayIso = day ? `${year}-${pad(month)}-${pad(day.n)}` : "";

  return (
    <>
      {/* Navegação de mês + novo evento discreto */}
      <div className="mb-2 flex items-center gap-1">
        <Link
          href={`/inicio?m=${prevM}`}
          aria-label="Mês anterior"
          className="inline-flex size-9 items-center justify-center rounded-full hover:bg-muted"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <h3 className="flex-1 text-center text-base font-semibold capitalize">{monthLabel}</h3>
        <Link
          href={`/inicio?m=${nextM}`}
          aria-label="Próximo mês"
          className="inline-flex size-9 items-center justify-center rounded-full hover:bg-muted"
        >
          <ChevronRight className="size-5" />
        </Link>
        <Link
          href="/escalas/novo"
          aria-label="Novo evento"
          className="press-sm ml-1 inline-flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground"
        >
          <Plus className="size-5" />
        </Link>
      </div>

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
                  <span className="font-medium text-warning-ink">Sem responsável ainda</span>
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

          {day && day.events.length === 0 ? (
            <p className="px-1 py-1 text-sm text-muted-foreground">Nenhum evento nesse dia ainda.</p>
          ) : null}

          <Link
            href={`/escalas/novo?data=${dayIso}`}
            className="press mt-1 flex w-full items-center justify-center gap-2 rounded-[14px] border border-dashed border-primary/40 py-3 text-sm font-bold text-primary"
          >
            <CalendarPlus className="size-4" /> Adicionar evento nesse dia
          </Link>
        </div>
      </Modal>
    </>
  );
}
