import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { TopBar } from "@/components/app-shell/top-bar";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { EscalasView } from "@/components/escalas-view";
import { cn } from "@/lib/utils";
import { getSession } from "@/lib/auth";
import { listUpcomingEvents } from "@/lib/data";

/**
 * A escala não tem página própria — abrir um evento renderiza a lista de
 * Escalas com o modal da escala aberto (`openId`). Deep-links pra
 * /escalas/[id] (notificações, cards) continuam funcionando.
 */
export default async function EventoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return null;
  const events = await listUpcomingEvents(session);
  const isAdmin = session.role === "admin";

  return (
    <>
      <TopBar title="Escalas" subtitle="Veja o que vem por aí" userName={session.profile.full_name || "?"} />
      <div className="animate-fade-in space-y-3 py-3">
        <Link href="/calendario" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <CalendarDays className="size-4" /> Ver o mês inteiro
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
            description="Quando houver um culto ou evento agendado, ele aparece aqui."
          />
        ) : null}

        <EscalasView events={events} canManage={session.role !== "volunteer"} openId={id} />
      </div>
    </>
  );
}
