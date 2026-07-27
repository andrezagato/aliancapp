import Link from "next/link";
import { CalendarDays, Plus, BarChart3 } from "lucide-react";
import { TopBar } from "@/components/app-shell/top-bar";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { EscalasView } from "@/components/escalas-view";
import { FinalizadosSection } from "@/components/finalizados-section";
import { cn } from "@/lib/utils";
import { getSession } from "@/lib/auth";
import { listUpcomingEvents, listEndedEvents } from "@/lib/data";

export default async function EscalasPage() {
  const session = await getSession();
  if (!session) return null;
  const [events, ended] = await Promise.all([listUpcomingEvents(session), listEndedEvents(session)]);
  const isAdmin = session.role === "admin";
  const canReview = isAdmin || session.profile.teams.some((t) => t.role === "leader");

  return (
    <>
      <TopBar title="Escalas" subtitle="Veja o que vem por aí" userName={session.profile.full_name || "?"} />
      <div className="animate-fade-in space-y-3 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link href="/calendario" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            <CalendarDays className="size-4" /> Ver o mês inteiro
          </Link>
          {session.role !== "volunteer" ? (
            <Link href="/balanco" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              <BarChart3 className="size-4" /> Balanço do mês
            </Link>
          ) : null}
        </div>
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
          <EscalasView events={events} canManage={session.role !== "volunteer"} openId={null} />
        )}

        <FinalizadosSection events={ended} canReview={canReview} />
      </div>
    </>
  );
}
