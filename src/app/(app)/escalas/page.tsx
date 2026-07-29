import Link from "next/link";
import { CalendarDays, Plus, BarChart3 } from "lucide-react";
import { TopBar } from "@/components/app-shell/top-bar";
import { EmptyState } from "@/components/empty-state";
import { EscalasView } from "@/components/escalas-view";
import { FinalizadosSection } from "@/components/finalizados-section";
import { SugerirEventoIconButton } from "@/components/event-request-controls";
import { getSession } from "@/lib/auth";
import { listUpcomingEvents, listEndedEvents, listTeams } from "@/lib/data";

export default async function EscalasPage() {
  const session = await getSession();
  if (!session) return null;
  const [events, ended, teams] = await Promise.all([
    listUpcomingEvents(session),
    listEndedEvents(session),
    listTeams(),
  ]);
  const isAdmin = session.role === "admin";
  const isLeader = session.role === "leader";
  const canReview = isAdmin || session.profile.teams.some((t) => t.role === "leader");

  return (
    <>
      <TopBar title="Escalas" subtitle="Veja o que vem por aí" userName={session.profile.full_name || "?"} />
      <div className="animate-fade-in space-y-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Link
              href="/calendario"
              aria-label="Ver o mês inteiro"
              className="inline-flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <CalendarDays className="size-[18px]" />
            </Link>
            {isAdmin ? (
              <Link
                href="/escalas/novo"
                aria-label="Criar evento"
                className="press-sm inline-flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground"
              >
                <Plus className="size-[18px]" />
              </Link>
            ) : isLeader ? (
              <SugerirEventoIconButton teams={teams} />
            ) : null}
          </div>
          {session.role !== "volunteer" ? (
            <Link href="/balanco" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              <BarChart3 className="size-4" /> Balanço do mês
            </Link>
          ) : null}
        </div>

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
          <EscalasView events={events} canManage={session.role !== "volunteer"} openId={null} />
        )}

        <FinalizadosSection events={ended} canReview={canReview} />
      </div>
    </>
  );
}
