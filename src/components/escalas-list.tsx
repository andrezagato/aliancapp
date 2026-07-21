"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CoverageBadge } from "@/components/coverage-badge";
import { EventEscalaModal } from "@/components/event/event-escala-modal";
import { cn } from "@/lib/utils";
import { fmtWeekdayShort, fmtDayMonthShort, fmtTime, churchDateISO } from "@/lib/format";
import type { EventListItem } from "@/lib/data";

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const s = new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(new Date(y, m - 1, 1)).replace(".", "");
  return `${s[0].toUpperCase()}${s.slice(1)}/${String(y).slice(2)}`;
}

/**
 * Lista de eventos da aba Escalas. `asModal` (líder) → tocar abre a escala da
 * equipe num bottom-sheet editável; senão → navega pra escala completa.
 * Filtro por mês pra lista não crescer demais.
 */
export function EscalasList({ events, asModal }: { events: EventListItem[]; asModal: boolean }) {
  const [openEvent, setOpenEvent] = useState<EventListItem | null>(null);

  const months = useMemo(() => {
    const set = new Set(events.map((e) => churchDateISO(e.starts_at).slice(0, 7)));
    return [...set].sort();
  }, [events]);
  const [month, setMonth] = useState<string>("all");
  const shown = month === "all" ? events : events.filter((e) => churchDateISO(e.starts_at).slice(0, 7) === month);

  return (
    <>
      {months.length > 1 ? (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {["all", ...months].map((k) => (
            <button
              key={k}
              onClick={() => setMonth(k)}
              className={cn(
                "press-sm shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-bold capitalize",
                month === k ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground",
              )}
            >
              {k === "all" ? "Todos" : monthLabel(k)}
            </button>
          ))}
        </div>
      ) : null}

      <div className="space-y-3">
        {shown.map((ev) => {
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
