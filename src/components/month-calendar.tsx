"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { EventListItem } from "@/lib/data";
import type { CoverageTone } from "@/lib/coverage";

const pad = (n: number) => String(n).padStart(2, "0");
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

// Fundo do dia por cobertura (quadrado colorido ao redor do número).
const BG: Record<CoverageTone, string> = {
  empty: "bg-destructive text-white",
  partial: "bg-warning text-foreground",
  full: "bg-success text-white",
};

function worstTone(events: EventListItem[]): CoverageTone {
  if (events.some((e) => e.overallTone === "empty")) return "empty";
  if (events.some((e) => e.overallTone === "partial")) return "partial";
  return "full";
}

/**
 * Grade mensal reutilizável (só o Card com cabeçalho de dias da semana + grid).
 * O rótulo do mês e a navegação ficam no pai.
 *
 * - `onDayClick`: se passado, cada dia com evento vira botão (líder → abre modal).
 * - senão, dias com evento viram âncora `#{anchorPrefix}-{dia}` (rola pra lista).
 *
 * `dayISO(ev)` deve devolver a data local (YYYY-MM-DD) do evento — passe uma
 * função do pai (server) que use o fuso da igreja; aqui só comparamos strings.
 */
export function MonthCalendar({
  year,
  month,
  events,
  eventDayISO,
  todayISO,
  onDayClick,
  anchorPrefix = "d",
}: {
  year: number;
  month: number; // 1-12
  events: EventListItem[];
  /** mapa evento.id -> "YYYY-MM-DD" (data local da igreja), calculado no server */
  eventDayISO: Record<string, string>;
  todayISO: string; // "YYYY-MM-DD"
  onDayClick?: (day: number, dayEvents: EventListItem[]) => void;
  anchorPrefix?: string;
}) {
  const ym = `${year}-${pad(month)}`;

  const byDay = new Map<number, EventListItem[]>();
  for (const ev of events) {
    const d = eventDayISO[ev.id];
    if (!d || !d.startsWith(ym)) continue;
    const day = Number(d.slice(8, 10));
    const arr = byDay.get(day) ?? [];
    arr.push(ev);
    byDay.set(day, arr);
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const startWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const todayDay = todayISO.startsWith(ym) ? Number(todayISO.slice(8, 10)) : -1;

  return (
    <Card className="p-3">
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-1 text-[11px] font-medium text-muted-foreground">
            {w}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} />;
          const dayEvents = byDay.get(day) ?? [];
          const has = dayEvents.length > 0;
          const tone = has ? worstTone(dayEvents) : null;
          const isToday = day === todayDay;
          const cellInner = (
            <div className="flex h-8 items-center justify-center">
              <div
                className={cn(
                  "flex size-8 items-center justify-center rounded-[9px] text-[13px]",
                  tone ? `${BG[tone]} font-bold` : "text-muted-foreground",
                  isToday && "ring-2 ring-primary",
                )}
              >
                {day}
              </div>
            </div>
          );
          // Com onDayClick, TODO dia é clicável (mesmo vazio) — permite pedir/criar evento ali.
          if (onDayClick) {
            return (
              <button
                key={day}
                type="button"
                onClick={() => onDayClick(day, dayEvents)}
                className="rounded-xl hover:bg-muted/60"
              >
                {cellInner}
              </button>
            );
          }
          if (!has) return <div key={day}>{cellInner}</div>;
          return (
            <a key={day} href={`#${anchorPrefix}-${day}`} className="rounded-xl hover:bg-muted/60">
              {cellInner}
            </a>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded bg-warning" /> parcial
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded bg-destructive" /> vazio
        </span>
      </div>
    </Card>
  );
}
