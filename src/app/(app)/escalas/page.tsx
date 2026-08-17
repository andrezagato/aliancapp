import Link from "next/link";
import { CalendarDays, BarChart3 } from "lucide-react";
import { TopBar } from "@/components/app-shell/top-bar";
import { EmptyState } from "@/components/empty-state";
import { EscalasView } from "@/components/escalas-view";
import { FinalizadosSection } from "@/components/finalizados-section";
import { EventRequestInbox, SugerirEventoIconButton } from "@/components/event-request-controls";
import { CalendarioGaveta } from "@/components/calendario-gaveta";
import { getSession } from "@/lib/auth";
import {
  listUpcomingEvents,
  listEndedEvents,
  listTeams,
  listEventsInRange,
  listPendingEventRequests,
  listTeamsWithPositions,
  listTemplates,
  type EventListItem,
} from "@/lib/data";
import { churchDateISO } from "@/lib/format";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * JANELA DO CALENDÁRIO — 6 meses (mês passado até 4 meses à frente).
 *
 * Por que a janela INTEIRA vem de uma vez, em vez de um mês por vez sob demanda:
 * a gaveta não pode recarregar a página, e uma server action por seta custaria
 * uma ida ao servidor por toque — no wi-fi da igreja, no domingo de manhã, com a
 * grade piscando a cada mês. E o custo de trazer tudo é praticamente zero:
 * `listEventsInRange` faz 3 consultas com range de 1 mês ou de 6 (só muda o
 * `gte`/`lt`), e a igreja tem 17 eventos no banco INTEIRO hoje — o mês mais
 * cheio (ago/2026) tem 14. Seis meses aqui são ~15 KB de RSC.
 * Trocar de mês vira troca de índice em memória: instantâneo, e funciona offline
 * (o app roda instalado).
 *
 * GATILHO PRA REVISAR: se a igreja passar de ~40 eventos/mês, aí sim vale trocar
 * por uma server action que busca o mês sob demanda.
 */
const MESES_ANTES = 1;
const MESES_DEPOIS = 4;

export default async function EscalasPage({
  searchParams,
}: {
  // `?novo=1&data=YYYY-MM-DD` vem do redirect de /escalas/novo (rota antiga).
  searchParams: Promise<{ novo?: string; data?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const sp = await searchParams;

  const isAdmin = session.role === "admin";
  const isLeader = session.role === "leader";
  const canReview = isAdmin || session.profile.teams.some((t) => t.role === "leader");

  const todayISO = churchDateISO(new Date().toISOString()); // YYYY-MM-DD (SP)
  const ay = Number(todayISO.slice(0, 4));
  const am = Number(todayISO.slice(5, 7));
  // Os "YYYY-MM" da janela, do mais antigo pro mais novo. Date.UTC normaliza a
  // virada de ano sozinho (mês 12 vira janeiro do ano seguinte).
  const meses = Array.from({ length: MESES_ANTES + 1 + MESES_DEPOIS }, (_, k) => {
    const d = new Date(Date.UTC(ay, am - 1 - MESES_ANTES + k, 1));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
  });
  const fromIso = new Date(`${meses[0]}-01T00:00:00-03:00`).toISOString();
  const fim = new Date(Date.UTC(ay, am + MESES_DEPOIS, 1)); // 1º dia DEPOIS da janela
  const toIso = new Date(
    `${fim.getUTCFullYear()}-${pad(fim.getUTCMonth() + 1)}-01T00:00:00-03:00`,
  ).toISOString();

  const [events, ended, teams, doMes, pendingRequests, teamsPos, templates] = await Promise.all([
    listUpcomingEvents(session),
    listEndedEvents(session),
    listTeams(),
    listEventsInRange(session, fromIso, toIso),
    // Guardas por papel: RLS já barra, mas não vale gastar a consulta.
    isAdmin ? listPendingEventRequests() : Promise.resolve([]),
    isAdmin ? listTeamsWithPositions() : Promise.resolve([]),
    isAdmin ? listTemplates() : Promise.resolve([]),
  ]);

  // Mapas prontos pro cliente. `churchDateISO` roda AQUI porque o dia é o da
  // igreja (America/Sao_Paulo), não o do aparelho de quem abriu.
  const eventDayISO: Record<string, string> = {};
  const eventosPorMes: Record<string, EventListItem[]> = Object.fromEntries(
    meses.map((k) => [k, [] as EventListItem[]]),
  );
  for (const ev of doMes) {
    const dia = churchDateISO(ev.starts_at);
    eventDayISO[ev.id] = dia;
    (eventosPorMes[dia.slice(0, 7)] ??= []).push(ev);
  }

  return (
    <>
      <TopBar title="Escalas" subtitle="Veja o que vem por aí" userName={session.profile.full_name || "?"} />
      <div className="animate-fade-in space-y-3 py-3">
        <CalendarioGaveta
          meses={meses}
          eventosPorMes={eventosPorMes}
          eventDayISO={eventDayISO}
          todayISO={todayISO}
          teams={teams}
          canRequest={isLeader}
          podeCriar={isAdmin}
          teamsComPosicoes={teamsPos}
          templates={templates}
          autoOpenNovo={isAdmin && sp.novo === "1"}
          dataInicialNovo={sp.data}
          acoes={
            session.role !== "volunteer" ? (
              <Link href="/balanco" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                <BarChart3 className="size-4" /> Balanço do mês
              </Link>
            ) : null
          }
        >
          {isLeader ? <SugerirEventoIconButton teams={teams} /> : null}
        </CalendarioGaveta>

        {/* Caixa de pedidos de evento — mudou-se de /calendario. Some sozinha
            quando não há pedido (EventRequestInbox devolve null). */}
        {isAdmin ? <EventRequestInbox requests={pendingRequests} /> : null}

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
