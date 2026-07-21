import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";
import { TopBar } from "@/components/app-shell/top-bar";
import { Card } from "@/components/ui/card";
import { RundownGrid } from "@/components/rundown-grid";
import { getSession } from "@/lib/auth";
import { listUpcomingEvents, getEventRundown, listRundownKinds, getRundownState } from "@/lib/data";
import { fmtEventWhen } from "@/lib/format";

export default async function CronogramaPage({ searchParams }: { searchParams: Promise<{ ev?: string }> }) {
  const session = await getSession();
  if (!session) return null;
  const { ev: evParam } = await searchParams;

  const upcoming = await listUpcomingEvents(session, 8);
  // Encerrados saem: escolhe o primeiro não-encerrado (ou o pedido via ?ev=).
  const states = await Promise.all(upcoming.map((e) => getRundownState(e.id)));
  const firstOpen = upcoming.findIndex((_, i) => !states[i].endedAt);
  const chosen = evParam ? upcoming.findIndex((e) => e.id === evParam) : -1;
  const idx = chosen >= 0 ? chosen : firstOpen;
  const ev = idx >= 0 ? upcoming[idx] : null;
  const state = idx >= 0 ? states[idx] : null;
  const [rundown, kinds] = ev
    ? await Promise.all([getEventRundown(ev.id), listRundownKinds()])
    : [[], await listRundownKinds()];
  const proximos = upcoming.filter((e, i) => i !== idx && !states[i].endedAt);
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
            {/* Barra compacta do culto (a régua abaixo é o foco) */}
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <CalendarDays className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold leading-tight">{ev.title}</p>
                <p className="truncate text-[13px] capitalize text-muted-foreground">{fmtEventWhen(ev.starts_at)}</p>
              </div>
              <Link
                href={`/escalas/${ev.id}`}
                className="press-sm shrink-0 rounded-full border border-border px-3 py-1.5 text-[13px] font-bold text-primary"
              >
                Escala
              </Link>
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

            {proximos.length > 0 ? (
              <section>
                <h3 className="mb-2 px-1 text-base font-semibold">Próximos cultos</h3>
                <Card>
                  <ul className="divide-y divide-border">
                    {proximos.map((e) => (
                      <li key={e.id}>
                        <Link href={`/cronograma?ev=${e.id}`} className="press-sm flex items-center gap-3 p-4">
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
