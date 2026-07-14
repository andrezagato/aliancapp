import Link from "next/link";
import { CalendarDays, ChevronRight, MapPin, Plus } from "lucide-react";
import { TopBar } from "@/components/app-shell/top-bar";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { CoverageBadge } from "@/components/coverage-badge";
import { cn } from "@/lib/utils";
import { getSession } from "@/lib/auth";
import { listUpcomingEvents } from "@/lib/data";
import { fmtEventDate, fmtTime } from "@/lib/format";

export default async function EscalasPage() {
  const session = await getSession();
  if (!session) return null;
  const events = await listUpcomingEvents(session);
  const isAdmin = session.role === "admin";

  return (
    <>
      <TopBar title="Escalas" subtitle="Próximos eventos" userName={session.profile.full_name || "?"} />
      <div className="animate-fade-in space-y-4 py-3">
        <Link href="/calendario" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <CalendarDays className="size-4" /> Ver por mês
        </Link>
        {isAdmin ? (
          <Link href="/escalas/novo" className={cn(buttonVariants(), "w-full")}>
            <Plus className="size-4" /> Criar evento
          </Link>
        ) : null}

        {events.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="size-7" />}
            title="Nenhum evento por aqui"
            description={
              isAdmin
                ? "Crie o primeiro culto ou evento e monte a escala das equipes."
                : "Quando houver um culto ou evento agendado, ele aparece aqui com a escala da sua equipe."
            }
          />
        ) : (
          <div className="space-y-3">
            {events.map((ev) => (
              <Card key={ev.id}>
                <Link href={`/escalas/${ev.id}`} className="press-sm block p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{ev.title}</p>
                      <p className="text-sm capitalize text-muted-foreground">{fmtEventDate(ev.starts_at)}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="size-3" /> {fmtTime(ev.starts_at)}
                        </span>
                        {ev.location ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="size-3" /> {ev.location}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground" />
                  </div>
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
        )}
      </div>
    </>
  );
}
