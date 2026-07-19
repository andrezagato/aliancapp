"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { EventListItem } from "@/lib/data";
import type { CoverageTone } from "@/lib/coverage";

const pad = (n: number) => String(n).padStart(2, "0");
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const DOT: Record<CoverageTone, string> = {
  empty: "bg-destructive",
  partial: "bg-warning",
  full: "bg-success",
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
            <div
              className={cn(
                "flex aspect-square flex-col items-center justify-center rounded-xl text-sm",
                isToday && "ring-2 ring-primary/40",
                has ? "font-semibold" : "text-muted-foreground",
              )}
            >
              {day}
              {tone ? <span className={cn("mt-0.5 size-1.5 rounded-full", DOT[tone])} /> : null}
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
    </Card>
  );
}
