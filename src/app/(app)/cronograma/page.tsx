import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";
import { TopBar } from "@/components/app-shell/top-bar";
import { Card } from "@/components/ui/card";
import { RundownGrid } from "@/components/rundown-grid";
import { getSession } from "@/lib/auth";
import { listUpcomingEvents, getEventRundown, listRundownKinds, getRundownState } from "@/lib/data";
import { fmtEventWhen } from "@/lib/format";

export default async function CronogramaPage() {
  const session = await getSession();
  if (!session) return null;

  const upcoming = await listUpcomingEvents(session, 6);
  const ev = upcoming[0] ?? null;
  const [rundown, kinds, state] = ev
    ? await Promise.all([getEventRundown(ev.id), listRundownKinds(), getRundownState(ev.id)])
    : [[], await listRundownKinds(), null];
  const leadIds = session.profile.teams.filter((t) => t.role === "leader").map((t) => t.id);
  const canEdit = ev
    ? session.role === "admin" || ev.responsibleId === session.userId || ev.teams.some((t) => leadIds.includes(t.teamId))
    : false;

  return (
    <>
      <TopBar title="Cronograma" subtitle="A ordem do próximo culto" userName={session.profile.full_name || "?"} />
      <div className="animate-fade-in space-y-3 py-3">
        {ev ? (
          <>
            {/* Herói do próximo culto */}
            <div className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-primary to-[hsl(349_74%_19%)] p-5 text-primary-foreground shadow-lift">
              <div
                className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full opacity-70"
                style={{ background: "radial-gradient(circle, hsl(var(--accent) / 0.45), transparent 70%)" }}
                aria-hidden
              />
              <div className="relative">
                <p className="text-xs font-semibold uppercase tracking-wider text-accent">Próximo culto</p>
                <h1 className="mt-1 font-display text-2xl font-extrabold text-white">{ev.title}</h1>
                <p className="mt-0.5 text-sm capitalize text-primary-foreground/85">{fmtEventWhen(ev.starts_at)}</p>
                <Link
                  href={`/escalas/${ev.id}`}
                  className="press mt-3 inline-flex items-center gap-1 rounded-full bg-white/15 px-3.5 py-1.5 text-sm font-bold text-white"
                >
                  Ver a escala do culto →
                </Link>
              </div>
            </div>

            <RundownGrid
              eventId={ev.id}
              startsAt={ev.starts_at}
              startedAt={state?.startedAt ?? null}
              endedAt={state?.endedAt ?? null}
              items={rundown}
              kinds={kinds}
              canEdit={canEdit}
            />

            {upcoming.length > 1 ? (
              <section>
                <h3 className="mb-2 px-1 text-base font-semibold">Próximos cultos</h3>
                <Card>
                  <ul className="divide-y divide-border">
                    {upcoming.slice(1).map((e) => (
                      <li key={e.id}>
                        <Link href={`/escalas/${e.id}`} className="press-sm flex items-center gap-3 p-4">
                          <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-primary/10 text-primary">
                            <CalendarDays className="size-[18px]" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{e.title}</span>
                            <span className="block truncate text-sm capitalize text-muted-foreground">
                              {fmtEventWhen(e.starts_at)}
                            </span>
                          </span>
                          <ChevronRight className="size-5 shrink-0 text-muted-foreground/50" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              </section>
            ) : null}
          </>
        ) : (
          <Card className="border-dashed">
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <span className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
                <CalendarDays className="size-7" />
              </span>
              <h2 className="font-display text-lg font-bold">Nenhum culto à frente</h2>
              <p className="max-w-xs text-balance text-sm text-muted-foreground">
                Quando houver um próximo culto, a ordem dele aparece aqui — pra você montar o passo a passo.
              </p>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
