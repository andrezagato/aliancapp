import Link from "next/link";
import {
  MapPin,
  CalendarDays,
  ChevronRight,
  Sparkles,
  Cake,
  UserPlus,
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { HomeShell } from "@/components/app-shell/home-shell";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_META } from "@/lib/status";
import { CoverageBadge, TeamDot } from "@/components/coverage-badge";
import { AssignmentResponse } from "@/components/assignment-response";
import { getSession } from "@/lib/auth";
import {
  getMyUpcomingAssignments,
  getLeaderHome,
  getAdminHome,
  getBirthdaysThisMonth,
  getSwapsAwaitingMe,
  getEventsAwaitingMyConfirmation,
  getMyOpenInterests,
  getMyNextResponsibleEvent,
  listTeamsWithPositions,
  listEventsInRange,
  listUpcomingEvents,
  type MyAssignment,
  type EventListItem,
  type MyResponsibleEvent,
  type SwapInboxItem,
  type MyInterest,
  type TeamWithPositions,
} from "@/lib/data";
import { fmtEventWhen, fmtWeekdayShort, fmtDayMonthShort, fmtTime, fmtBirthday, churchDateISO } from "@/lib/format";
import { CheckinButton } from "@/components/slot-controls";
import { SwapInbox } from "@/components/swap-inbox";
import { InteresseButton, InteresseResolveButton } from "@/components/interesse-controls";
import { VolunteerHome } from "@/components/home/volunteer-home";
import { NextEventHero } from "@/components/home/next-event-hero";
import { AdminMonthOverview } from "@/components/home/admin-month-overview";
import { LeaderMonthBoard } from "@/components/home/leader-month-board";

const pad = (n: number) => String(n).padStart(2, "0");

function greeting() {
  const h = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date()));
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function InicioPage() {
  const session = await getSession();
  if (!session) return null;

  const [swaps, respEvents, myInterests, teamsWithPos, myResponsibleEvent] = await Promise.all([
    getSwapsAwaitingMe(session),
    getEventsAwaitingMyConfirmation(session),
    getMyOpenInterests(session),
    listTeamsWithPositions(),
    getMyNextResponsibleEvent(session),
  ]);
  const first = session.profile.full_name?.split(/\s+/)[0] || "Olá";
  const lead = session.profile.teams.filter((t) => t.role === "leader").map((t) => t.name);
  const roleLabel =
    session.role === "admin"
      ? "Administrador"
      : session.role === "leader"
        ? `Líder · ${lead.join(", ")}`
        : session.profile.teams.map((t) => t.name).join(", ") || "Voluntário";

  const userName = session.profile.full_name || "?";
  const respHero = myResponsibleEvent ? (
    <NextEventHero ev={myResponsibleEvent} kicker="Você é o responsável" caption="confirmados" />
  ) : null;

  // Voluntário: experiência "Aconchego" completa (cabeçalho reativo,
  // pull-to-refresh, herói, swipe). Os blocos extras entram como children.
  if (session.role === "volunteer") {
    const mine = await getMyUpcomingAssignments(session);
    return (
      <VolunteerHome title={`${greeting()}, ${first}`} subtitle={roleLabel} userName={userName} assignments={mine}>
        {respHero}
        <SwapInbox items={swaps} />
        <ResponsibleConfirm events={respEvents} />
        <Servir teams={teamsWithPos} interests={myInterests} />
        <Birthdays />
      </VolunteerHome>
    );
  }

  // Admin: abre com o calendário do mês, ações principais e a lista de eventos
  // com o responsável de cada um.
  if (session.role === "admin") {
    return (
      <HomeShell title={`${greeting()}, ${first}`} subtitle={roleLabel} userName={userName}>
        {respHero}
        <AdminSection swaps={swaps} respEvents={respEvents} />
        <Servir teams={teamsWithPos} interests={myInterests} />
        <Birthdays />
      </HomeShell>
    );
  }

  // Líder: foco no próximo culto da equipe e nas próximas escalas.
  return (
    <HomeShell title={`${greeting()}, ${first}`} subtitle={roleLabel} userName={userName}>
      {respHero}
      <SwapInbox items={swaps} />
      <ResponsibleConfirm events={respEvents} />
      <LeaderSection hideHeroForEventId={myResponsibleEvent?.id ?? null} />
      <Servir teams={teamsWithPos} interests={myInterests} />
      <Birthdays />
    </HomeShell>
  );
}

// -----------------------------------------------------------------------------
// LISTA DE ESCALAS (usada pelo líder na home)
// -----------------------------------------------------------------------------
function MyScheduleList({ mine, title }: { mine: MyAssignment[]; title: string }) {
  const todaySP = churchDateISO(new Date().toISOString());
  if (mine.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <span className="inline-flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CalendarDays className="size-7" />
          </span>
          <h3 className="text-lg font-semibold">Nenhuma escala por enquanto</h3>
          <p className="max-w-xs text-balance text-sm text-muted-foreground">
            Quando um líder te escalar para servir, aparece aqui — e você confirma num toque.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <section>
      <h3 className="mb-2 px-1 text-base font-semibold">{title}</h3>
      <div className="space-y-3">
        {mine.map((a) => {
          const meta = STATUS_META[a.status];
          return (
            <Card key={a.assignmentId}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-muted py-1.5 text-center">
                    <span className="text-[11px] font-medium uppercase text-muted-foreground">
                      {fmtWeekdayShort(a.startsAt)}
                    </span>
                    <span className="text-lg font-semibold leading-none">
                      {fmtDayMonthShort(a.startsAt).split(" ")[0]}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{fmtTime(a.startsAt)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/escalas/${a.eventId}`} className="font-medium hover:underline">
                      {a.eventTitle}
                    </Link>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <TeamDot color={a.teamColor} /> {a.teamName} · {a.positionName}
                    </p>
                    {a.location ? (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3" /> {a.location}
                      </p>
                    ) : null}
                  </div>
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                </div>
                {churchDateISO(a.startsAt) === todaySP && (a.status === "confirmado" || a.checkedIn) ? (
                  <div className="mt-3 border-t border-border/70 pt-3">
                    <CheckinButton
                      assignmentId={a.assignmentId}
                      teamId={a.teamId}
                      eventId={a.eventId}
                      checkedIn={a.checkedIn}
                      canMark
                      prominent
                    />
                  </div>
                ) : a.status === "convidado" || a.status === "confirmado" ? (
                  <div className="mt-3 flex justify-end border-t border-border/70 pt-3">
                    <AssignmentResponse assignmentId={a.assignmentId} status={a.status} teamId={a.teamId} />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// LÍDER
// -----------------------------------------------------------------------------
async function LeaderSection({ hideHeroForEventId }: { hideHeroForEventId: string | null }) {
  const session = (await getSession())!;
  const leadIds = session.profile.teams.filter((t) => t.role === "leader").map((t) => t.id);

  const todayISO = churchDateISO(new Date().toISOString());
  const y = Number(todayISO.slice(0, 4));
  const m = Number(todayISO.slice(5, 7));
  const fromIso = new Date(`${y}-${pad(m)}-01T00:00:00-03:00`).toISOString();
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const toIso = new Date(`${ny}-${pad(nm)}-01T00:00:00-03:00`).toISOString();

  const [home, mine, monthRaw] = await Promise.all([
    getLeaderHome(session),
    getMyUpcomingAssignments(session),
    listEventsInRange(session, fromIso, toIso),
  ]);

  const monthEvents = monthRaw
    .map((ev) => ({ ...ev, teams: ev.teams.filter((t) => leadIds.includes(t.teamId)) }))
    .filter((ev) => ev.teams.length > 0);
  const calendarDayISO: Record<string, string> = Object.fromEntries(
    monthEvents.map((e) => [e.id, churchDateISO(e.starts_at)]),
  );

  const rawNext = home.events[0] ?? null;
  const nextTeamEvent = rawNext && rawNext.id !== hideHeroForEventId ? rawNext : null;

  return (
    <>
      {nextTeamEvent ? <NextEventHero ev={nextTeamEvent} kicker="Próximo da sua equipe" caption="confirmados" /> : null}

      <LeaderMonthBoard
        year={y}
        month={m}
        calendarEvents={monthEvents}
        calendarDayISO={calendarDayISO}
        todayISO={todayISO}
      />

      {home.openVacancies > 0 ? (
        <Link
          href="/escalas"
          className="flex items-center gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-3.5"
        >
          <span className="inline-flex size-9 items-center justify-center rounded-full bg-warning/15 text-warning">
            <AlertTriangle className="size-5" />
          </span>
          <span className="flex-1 text-sm font-medium">
            Alguns próximos eventos da sua equipe precisam da sua atenção
          </span>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
        </Link>
      ) : null}

      {home.interests.length > 0 ? (
        <section>
          <h3 className="mb-2 px-1 text-base font-semibold">Quem quer servir na sua equipe</h3>
          <Card>
            <ul className="divide-y divide-border">
              {home.interests.map((i) => (
                <li key={i.id} className="flex items-center gap-3 p-4">
                  <span className="inline-flex size-10 items-center justify-center rounded-full bg-accent/15 text-accent">
                    <Sparkles className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{i.personName}</span> quer servir em{" "}
                      <span className="font-medium">{i.teamName}</span>
                      {i.positionName ? ` (${i.positionName})` : ""}
                    </p>
                    {i.note ? <p className="truncate text-sm text-muted-foreground">{i.note}</p> : null}
                    <div className="mt-1.5">
                      <InteresseResolveButton
                        id={i.id}
                        teamId={i.teamId}
                        personName={i.personName}
                        teamName={i.teamName}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      {home.resolvedInterests.length > 0 ? (
        <details className="rounded-2xl border border-border bg-card">
          <summary className="flex cursor-pointer items-center justify-between p-4 text-sm font-semibold">
            Histórico de pedidos
            <span className="text-xs font-medium text-muted-foreground">{home.resolvedInterests.length}</span>
          </summary>
          <ul className="divide-y divide-border border-t border-border">
            {home.resolvedInterests.map((i) => (
              <li key={i.id} className="p-4 text-sm">
                <p className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium">{i.personName}</span>
                  <span className="text-muted-foreground">· {i.teamName}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      i.status === "atendido" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {i.status === "atendido" ? "Aceito" : "Recusado"}
                  </span>
                </p>
                {i.resolvedNote ? (
                  <p className="mt-0.5 text-[13px] italic text-muted-foreground">“{i.resolvedNote}”</p>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {mine.length > 0 ? <MyScheduleList mine={mine} title="Confirme sua escala" /> : null}
    </>
  );
}

// -----------------------------------------------------------------------------
// ADMIN
// -----------------------------------------------------------------------------
async function AdminSection({
  swaps,
  respEvents,
}: {
  swaps: SwapInboxItem[];
  respEvents: MyResponsibleEvent[];
}) {
  const session = (await getSession())!;

  const todayISO = churchDateISO(new Date().toISOString());
  const y = Number(todayISO.slice(0, 4));
  const m = Number(todayISO.slice(5, 7));
  const fromIso = new Date(`${y}-${pad(m)}-01T00:00:00-03:00`).toISOString();
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const toIso = new Date(`${ny}-${pad(nm)}-01T00:00:00-03:00`).toISOString();

  const [home, monthEvents, upcoming] = await Promise.all([
    getAdminHome(session),
    listEventsInRange(session, fromIso, toIso),
    listUpcomingEvents(session, 8),
  ]);
  const eventDayISO: Record<string, string> = Object.fromEntries(
    monthEvents.map((e) => [e.id, churchDateISO(e.starts_at)]),
  );

  return (
    <>
      {/* Calendário do mês — visão geral (toque num dia p/ ver os eventos) */}
      <section>
        <h3 className="mb-2 px-1 text-base font-semibold">Veja o calendário do mês</h3>
        <AdminMonthOverview year={y} month={m} events={monthEvents} eventDayISO={eventDayISO} todayISO={todayISO} />
      </section>

      {/* Ações principais do admin */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/escalas/novo" className={cn(buttonVariants(), "w-full")}>
          <Plus className="size-4" /> Criar evento
        </Link>
        <Link href="/pessoas" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
          <UserPlus className="size-4" /> Convidar alguém
        </Link>
      </div>

      {/* Aprovações pendentes — acionável */}
      {home.pendingJoinRequests > 0 ? (
        <Link
          href="/pessoas"
          className="flex items-center gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-3.5"
        >
          <span className="inline-flex size-9 items-center justify-center rounded-full bg-warning/15 text-warning">
            <UserPlus className="size-5" />
          </span>
          <span className="flex-1 text-sm font-medium">
            {home.pendingJoinRequests} {home.pendingJoinRequests > 1 ? "pessoas querem" : "pessoa quer"} entrar — toque
            para aprovar
          </span>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
        </Link>
      ) : null}

      {/* Pendências acionáveis */}
      <SwapInbox items={swaps} />
      <ResponsibleConfirm events={respEvents} />

      {/* Próximos eventos com o responsável de cada um */}
      <AdminUpcomingList events={upcoming} />
    </>
  );
}

function AdminUpcomingList({ events }: { events: EventListItem[] }) {
  if (events.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-2 px-6 py-8 text-center">
          <CheckCircle2 className="size-8 text-success" />
          <p className="max-w-xs text-balance text-sm text-muted-foreground">
            Nenhum evento à frente. Que tal criar o próximo culto?
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <section>
      <h3 className="mb-2 px-1 text-base font-semibold">Próximos eventos</h3>
      <div className="space-y-3">
        {events.map((ev) => (
          <Card key={ev.id}>
            <Link href={`/escalas/${ev.id}`} className="block p-4 hover:bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{ev.title}</p>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">{fmtEventWhen(ev.starts_at)}</p>
              <p className="mt-0.5 text-sm">
                {ev.responsibleName ? (
                  <span className="text-muted-foreground">
                    Responsável: <span className="font-medium text-foreground">{ev.responsibleName}</span>
                  </span>
                ) : (
                  <span className="font-medium text-warning">Sem responsável ainda</span>
                )}
              </p>
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
  );
}

// -----------------------------------------------------------------------------
// COMPARTILHADOS
// -----------------------------------------------------------------------------
function ResponsibleConfirm({ events }: { events: MyResponsibleEvent[] }) {
  if (events.length === 0) return null;
  return (
    <section>
      <h3 className="mb-2 px-1 text-base font-semibold">Confirme como responsável</h3>
      <Card>
        <ul className="divide-y divide-border">
          {events.map((e) => (
            <li key={e.eventId}>
              <Link href={`/escalas/${e.eventId}`} className="flex items-center gap-3 p-4 hover:bg-muted/50">
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-warning/12 text-warning">
                  <Clock className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{e.title}</p>
                  <p className="text-sm text-muted-foreground">{fmtEventWhen(e.startsAt)} · confirme que vai acontecer</p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

function Servir({ teams, interests }: { teams: TeamWithPositions[]; interests: MyInterest[] }) {
  return (
    <section className="space-y-2">
      <InteresseButton teams={teams} />
      {interests.length > 0 ? (
        <Card>
          <ul className="divide-y divide-border">
            {interests.map((i) => (
              <li key={i.id} className="flex items-center gap-2 p-3 pl-4 text-sm">
                <Sparkles className="size-4 shrink-0 text-accent" />
                <span>
                  Interesse enviado: <span className="font-medium">{i.teamName}</span>
                  {i.positionName ? ` · ${i.positionName}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </section>
  );
}

async function Birthdays() {
  const list = await getBirthdaysThisMonth();
  if (list.length === 0) return null;
  return (
    <section>
      <h3 className="mb-2 px-1 text-base font-semibold">Aniversariantes do mês</h3>
      <Card>
        <ul className="divide-y divide-border">
          {list.map((b, i) => (
            <li key={i} className="flex items-center gap-3 p-4">
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-accent/15 text-accent">
                <Cake className="size-5" />
              </span>
              <span className="flex-1 font-medium">{b.name}</span>
              <span className="text-sm text-muted-foreground">{fmtBirthday(b.birthDate)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
