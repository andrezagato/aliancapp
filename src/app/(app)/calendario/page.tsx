import Link from "next/link";
import { ChevronLeft, ChevronRight, List, MapPin } from "lucide-react";
import { TopBar } from "@/components/app-shell/top-bar";
import { Card } from "@/components/ui/card";
import { CoverageBadge } from "@/components/coverage-badge";
import { MonthCalendar } from "@/components/month-calendar";
import { getSession } from "@/lib/auth";
import { listEventsInRange, type EventListItem } from "@/lib/data";
import { churchDateISO, fmtTime } from "@/lib/format";

const pad = (n: number) => String(n).padStart(2, "0");

function monthLabel(y: number, m: number): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
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
  const eventDayISO: Record<string, string> = Object.fromEntries(
    events.map((e) => [e.id, churchDateISO(e.starts_at)]),
  );

  // Agrupa por dia do mês (pra lista abaixo).
  const byDay = new Map<number, EventListItem[]>();
  for (const ev of events) {
    const d = eventDayISO[ev.id];
    if (!d.startsWith(`${y}-${pad(m)}`)) continue;
    const day = Number(d.slice(8, 10));
    const arr = byDay.get(day) ?? [];
    arr.push(ev);
    byDay.set(day, arr);
  }

  const prev = m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
  const next = m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;

  const daysWithEvents = [...byDay.keys()].sort((a, b) => a - b);

  return (
    <>
      <TopBar title="Calendário" subtitle="Veja o mês inteiro" userName={session.profile.full_name || "?"} />
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

        <MonthCalendar year={y} month={m} events={events} eventDayISO={eventDayISO} todayISO={todayISO} />

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
