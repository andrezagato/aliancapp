import Link from "next/link";
import { ChevronLeft, ChevronRight, List, MapPin } from "lucide-react";
import { TopBar } from "@/components/app-shell/top-bar";
import { Card } from "@/components/ui/card";
import { CoverageBadge } from "@/components/coverage-badge";
import { cn } from "@/lib/utils";
import { getSession } from "@/lib/auth";
import { listEventsInRange, type EventListItem } from "@/lib/data";
import { churchDateISO, fmtTime } from "@/lib/format";
import type { CoverageTone } from "@/lib/coverage";

const pad = (n: number) => String(n).padStart(2, "0");
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const DOT: Record<CoverageTone, string> = {
  empty: "bg-destructive",
  partial: "bg-warning",
  full: "bg-success",
};

function monthLabel(y: number, m: number): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
}

function worstTone(events: EventListItem[]): CoverageTone {
  if (events.some((e) => e.overallTone === "empty")) return "empty";
  if (events.some((e) => e.overallTone === "partial")) return "partial";
  return "full";
}

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const sp = await searchParams;

  const todayISO = churchDateISO(new Date().toISOString()); // YYYY-MM-DD (SP)
  const monthStr = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : todayISO.slice(0, 7);
  const y = Number(monthStr.slice(0, 4));
  const m = Number(monthStr.slice(5, 7));

  const fromIso = new Date(`${y}-${pad(m)}-01T00:00:00-03:00`).toISOString();
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const toIso = new Date(`${ny}-${pad(nm)}-01T00:00:00-03:00`).toISOString();

  const events = await listEventsInRange(session, fromIso, toIso);

  // Agrupa por dia do mês.
  const byDay = new Map<number, EventListItem[]>();
  for (const ev of events) {
    const d = churchDateISO(ev.starts_at);
    if (!d.startsWith(`${y}-${pad(m)}`)) continue;
    const day = Number(d.slice(8, 10));
    (byDay.get(day) ?? byDay.set(day, []).get(day)!).push(ev);
  }

  const daysInMonth = new Date(y, m, 0).getDate();
  const startWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const todayDay = todayISO.startsWith(`${y}-${pad(m)}`) ? Number(todayISO.slice(8, 10)) : -1;

  const prev = m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
  const next = m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;

  const daysWithEvents = [...byDay.keys()].sort((a, b) => a - b);

  return (
    <>
      <TopBar title="Calendário" subtitle="Visão do mês" userName={session.profile.full_name || "?"} />
      <div className="animate-fade-in space-y-4 py-3">
        <div className="flex items-center justify-between">
          <Link href={`/calendario?m=${prev}`} aria-label="Mês anterior" className="inline-flex size-9 items-center justify-center rounded-full hover:bg-muted">
            <ChevronLeft className="size-5" />
          </Link>
          <h2 className="text-lg font-semibold capitalize">{monthLabel(y, m)}</h2>
          <Link href={`/calendario?m=${next}`} aria-label="Próximo mês" className="inline-flex size-9 items-center justify-center rounded-full hover:bg-muted">
            <ChevronRight className="size-5" />
          </Link>
        </div>

        <Card className="p-3">
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((w) => (
              <div key={w} className="pb-1 text-[11px] font-medium text-muted-foreground">{w}</div>
            ))}
            {cells.map((day, i) => {
              if (day === null) return <div key={`e${i}`} />;
              const dayEvents = byDay.get(day);
              const tone = dayEvents ? worstTone(dayEvents) : null;
              const isToday = day === todayDay;
              const cellInner = (
                <div
                  className={cn(
                    "flex aspect-square flex-col items-center justify-center rounded-xl text-sm",
                    isToday && "ring-2 ring-primary/40",
                    dayEvents ? "font-semibold" : "text-muted-foreground",
                  )}
                >
                  {day}
                  {tone ? <span className={cn("mt-0.5 size-1.5 rounded-full", DOT[tone])} /> : null}
                </div>
              );
              return dayEvents ? (
                <a key={day} href={`#d-${day}`} className="hover:bg-muted/60 rounded-xl">{cellInner}</a>
              ) : (
                <div key={day}>{cellInner}</div>
              );
            })}
          </div>
        </Card>

        <Link href="/escalas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <List className="size-4" /> Ver em lista
        </Link>

        {daysWithEvents.length === 0 ? (
          <p className="px-1 text-sm text-muted-foreground">Nenhum evento neste mês.</p>
        ) : (
          <div className="space-y-4">
            {daysWithEvents.map((day) => (
              <section key={day} id={`d-${day}`} className="scroll-mt-20">
                <h3 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">
                  {pad(day)}/{pad(m)}
                </h3>
                <div className="space-y-3">
                  {byDay.get(day)!.map((ev) => (
                    <Card key={ev.id}>
                      <Link href={`/escalas/${ev.id}`} className="block p-4 hover:bg-muted/40">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{ev.title}</p>
                          <span className="text-sm text-muted-foreground">{fmtTime(ev.starts_at)}</span>
                        </div>
                        {ev.location ? (
                          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="size-3" /> {ev.location}
                          </p>
                        ) : null}
                        {ev.teams.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {ev.teams.map((t) => (
                              <CoverageBadge key={t.teamId} tone={t.tone} label={`${t.name} ${t.assigned}/${t.needed}`} />
                            ))}
                          </div>
                        ) : null}
                      </Link>
                    </Card>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
