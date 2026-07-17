"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { MonthCalendar } from "@/components/month-calendar";
import { Modal } from "@/components/modal";
import { CoverageBadge } from "@/components/coverage-badge";
import { EventTeams } from "@/components/event/event-teams";
import { carregarEventoParaModal, type EventoModalData } from "@/lib/actions";
import { fmtEventWhen, fmtTime } from "@/lib/format";
import type { EventListItem } from "@/lib/data";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Home do líder: calendário com os dias em que a equipe serve + lista dos
 * próximos cultos. Tocar num dia (ou num item da lista) abre um bottom-sheet
 * com a escala da equipe naquele evento — editável ali mesmo (reusa EventTeams),
 * fechando ao deslizar pra baixo ou no ×. Menos página carregando.
 *
 * O detalhe é recarregado sempre que a home revalida (as listas trocam de
 * referência após um router.refresh() vindo de dentro do EventTeams), então a
 * escala no modal reflete a última edição.
 */
export function LeaderMonthBoard({
  year,
  month,
  calendarEvents,
  calendarDayISO,
  todayISO,
  listEvents,
}: {
  year: number;
  month: number;
  calendarEvents: EventListItem[];
  calendarDayISO: Record<string, string>;
  todayISO: string;
  listEvents: EventListItem[];
}) {
  const [dayPick, setDayPick] = useState<{ n: number; events: EventListItem[] } | null>(null);
  const [openEvent, setOpenEvent] = useState<EventListItem | null>(null);
  const [detail, setDetail] = useState<EventoModalData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!openEvent) {
      setDetail(null);
      return;
    }
    let alive = true;
    setLoading(true);
    carregarEventoParaModal(openEvent.id).then((d) => {
      if (alive) {
        setDetail(d);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
    // recarrega quando a home revalida (calendarEvents/listEvents mudam de ref)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openEvent, calendarEvents, listEvents]);

  const pick = (evs: EventListItem[], n: number) => {
    if (evs.length === 1) setOpenEvent(evs[0]);
    else setDayPick({ n, events: evs });
  };
  const close = () => {
    setOpenEvent(null);
    setDayPick(null);
    setDetail(null);
  };

  const modalOpen = !!openEvent || !!dayPick;
  const modalTitle = openEvent ? openEvent.title : dayPick ? `Dia ${pad(dayPick.n)}/${pad(month)}` : "";

  return (
    <>
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
      </section>

      <section>
        <h3 className="mb-2 px-1 text-base font-semibold">Próximos cultos da equipe</h3>
        {listEvents.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="px-6 py-8 text-center text-sm text-muted-foreground">
              Nenhum evento à frente. Peça ao admin para criar o próximo culto.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {listEvents.map((ev) => (
              <Card key={ev.id}>
                <button
                  type="button"
                  onClick={() => setOpenEvent(ev)}
                  className="block w-full p-4 text-left hover:bg-muted/40"
                >
                  <p className="font-medium">{ev.title}</p>
                  <p className="text-sm text-muted-foreground">{fmtEventWhen(ev.starts_at)}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ev.teams.map((t) => (
                      <CoverageBadge key={t.teamId} tone={t.tone} label={`${t.name} ${t.assigned}/${t.needed}`} />
                    ))}
                  </div>
                </button>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Modal open={modalOpen} onClose={close} sheet title={modalTitle}>
        {/* Passo 1: escolher qual evento do dia (quando há mais de um) */}
        {!openEvent && dayPick ? (
          <div className="space-y-2 pt-1">
            {dayPick.events.map((ev) => (
              <button
                key={ev.id}
                type="button"
                onClick={() => setOpenEvent(ev)}
                className="flex w-full items-center justify-between gap-2 rounded-2xl border border-border p-3.5 text-left hover:bg-muted/40"
              >
                <span className="min-w-0">
                  <span className="block font-semibold">{ev.title}</span>
                  <span className="text-sm text-muted-foreground">{fmtTime(ev.starts_at)}</span>
                </span>
                <CoverageBadge tone={ev.overallTone} label={`${ev.assignedTotal}/${ev.neededTotal}`} />
              </button>
            ))}
          </div>
        ) : null}

        {/* Passo 2: a escala do evento — editável */}
        {openEvent ? (
          <div className="pt-1">
            <p className="mb-3 text-sm capitalize text-muted-foreground">{fmtEventWhen(openEvent.starts_at)}</p>
            {loading || !detail ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
            ) : !detail.ok || !detail.teams ? (
              <p className="py-8 text-center text-sm text-destructive">
                {detail.error ?? "Não foi possível carregar."}
              </p>
            ) : detail.teams.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Você não gerencia equipes neste evento.
              </p>
            ) : (
              <EventTeams eventId={openEvent.id} canCheckin={!!detail.canCheckin} teams={detail.teams} />
            )}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
