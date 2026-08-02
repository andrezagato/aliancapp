import Link from "next/link";
import {
  MapPin,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Cake,
  UserPlus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  CalendarPlus,
} from "lucide-react";
import { HomeShell } from "@/components/app-shell/home-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_META } from "@/lib/status";
import { TeamDot } from "@/components/coverage-badge";
import { EventPiesCard } from "@/components/event-pies-card";
import { AbrirEscala } from "@/components/event/abrir-escala";
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
  getPendingFeedback,
  getCultoAoVivo,
  getPendingTeamReviews,
  getMyEventRequests,
  getTeamCare,
  getTeamAchievements,
  listPendingEventRequests,
  listTeams,
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
import { FeedbackPrompt } from "@/components/feedback-prompt";
import { ProfilePrompt } from "@/components/home/profile-prompt";
import { CultoAoVivo } from "@/components/home/culto-ao-vivo";
import { TeamReviewPrompt } from "@/components/team-review";
import { NextEventHero } from "@/components/home/next-event-hero";
import { AdminMonthOverview } from "@/components/home/admin-month-overview";
import { TeamCalendar } from "@/components/home/team-calendar";

const pad = (n: number) => String(n).padStart(2, "0");

function greeting() {
  const h = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date()));
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function InicioPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const sp = await searchParams;

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
  // Vale pros três ramos (voluntário, líder, admin): o culto é da igreja toda.
  const aoVivo = await getCultoAoVivo(session);
  const cardAoVivo = aoVivo ? (
    <CultoAoVivo eventId={aoVivo.eventId} title={aoVivo.title} startedAt={aoVivo.startedAt} />
  ) : null;
  const respHero = myResponsibleEvent ? (
    <NextEventHero ev={myResponsibleEvent} kicker="Você é o responsável" caption="confirmados" />
  ) : null;

  // Voluntário: experiência "Aconchego" completa (cabeçalho reativo,
  // pull-to-refresh, herói, swipe). Os blocos extras entram como children.
  if (session.role === "volunteer") {
    const [mine, pendingFeedback] = await Promise.all([
      getMyUpcomingAssignments(session),
      getPendingFeedback(session),
    ]);
    const p = session.profile;
    const missingProfile = [
      !p.avatar_url ? "sua foto" : null,
      !p.phone ? "o telefone" : null,
      !p.birth_date ? "a data de nascimento" : null,
    ].filter((x): x is string => x !== null);
    return (
      <VolunteerHome title={`${greeting()}, ${first}`} subtitle={roleLabel} userName={userName} assignments={mine}>
        {cardAoVivo}
        <ProfilePrompt meId={session.userId} missing={missingProfile} />
        {respHero}
        <SwapInbox items={swaps} />
        <ResponsibleConfirm events={respEvents} />
        <FeedbackPrompt pending={pendingFeedback} />
        <Servir teams={teamsWithPos} interests={myInterests} />
        <QuickTiles />
        <Birthdays />
      </VolunteerHome>
    );
  }

  // Admin: abre com o calendário do mês, ações principais e a lista de eventos
  // com o responsável de cada um. Admin também lidera equipes → recebe o aviso
  // de avaliação do culto (senão só apareceria no ramo "líder").
  if (session.role === "admin") {
    const pendingReviews = await getPendingTeamReviews(session);
    return (
      <HomeShell title={`${greeting()}, ${first}`} subtitle={roleLabel} userName={userName}>
        {cardAoVivo}
        {respHero}
        <TeamReviewPrompt pending={pendingReviews} />
        <AdminSection swaps={swaps} respEvents={respEvents} mes={sp.m} />
        <Birthdays />
      </HomeShell>
    );
  }

  // Líder: foco no próximo culto da equipe e nas próximas escalas.
  const pendingReviews = await getPendingTeamReviews(session);
  return (
    <HomeShell title={`${greeting()}, ${first}`} subtitle={roleLabel} userName={userName}>
      {cardAoVivo}
      {respHero}
      <TeamReviewPrompt pending={pendingReviews} />
      <SwapInbox items={swaps} />
      <ResponsibleConfirm events={respEvents} />
      <LeaderSection hideHeroForEventId={myResponsibleEvent?.id ?? null} mes={sp.m} />
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
                    <AbrirEscala eventId={a.eventId} className="text-left font-medium hover:underline">
                      {a.eventTitle}
                    </AbrirEscala>
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
async function LeaderSection({
  hideHeroForEventId,
  mes,
}: {
  hideHeroForEventId: string | null;
  mes?: string;
}) {
  const session = (await getSession())!;
  const leadIds = session.profile.teams.filter((t) => t.role === "leader").map((t) => t.id);

  const todayISO = churchDateISO(new Date().toISOString());
  const monthStr = /^\d{4}-\d{2}$/.test(mes ?? "") ? mes! : todayISO.slice(0, 7);
  const y = Number(monthStr.slice(0, 4));
  const m = Number(monthStr.slice(5, 7));
  const fromIso = new Date(`${y}-${pad(m)}-01T00:00:00-03:00`).toISOString();
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const toIso = new Date(`${ny}-${pad(nm)}-01T00:00:00-03:00`).toISOString();
  const prevM = m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
  const nextM = m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );

  const [home, mine, monthRaw, myEventRequests, teams, teamCare, teamAchv] = await Promise.all([
    getLeaderHome(session),
    getMyUpcomingAssignments(session),
    listEventsInRange(session, fromIso, toIso),
    getMyEventRequests(session),
    listTeams(),
    getTeamCare(session),
    getTeamAchievements(session),
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

      <section>
        <div className="mb-2 flex items-center gap-1">
          <Link
            href={`/inicio?m=${prevM}`}
            aria-label="Mês anterior"
            className="inline-flex size-9 items-center justify-center rounded-full hover:bg-muted"
          >
            <ChevronLeft className="size-5" />
          </Link>
          <h3 className="flex-1 text-center text-base font-semibold capitalize">{monthLabel}</h3>
          <Link
            href={`/inicio?m=${nextM}`}
            aria-label="Próximo mês"
            className="inline-flex size-9 items-center justify-center rounded-full hover:bg-muted"
          >
            <ChevronRight className="size-5" />
          </Link>
        </div>
        <TeamCalendar
          year={y}
          month={m}
          events={monthEvents}
          eventDayISO={calendarDayISO}
          todayISO={todayISO}
          teams={teams}
          hint="Toque num dia pra ver a escala ou pedir um evento."
        />
      </section>

      {teamCare.length > 0 ? (
        <details className="rounded-2xl border border-border bg-card">
          <summary className="cursor-pointer p-4 text-base font-semibold">Cuidado com a equipe</summary>
          <div className="divide-y divide-border border-t border-border">
            {teamCare.map((tc) => {
              const top = tc.members.reduce((mx, m) => Math.max(mx, m.served90), 0);
              return (
                <div key={tc.teamName} className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{tc.teamName}</p>
                    {tc.servedThisMonth > 0 ? (
                      <span className="text-[12px] font-semibold text-success-ink">
                        {tc.servedThisMonth} presenças este mês 🎉
                      </span>
                    ) : null}
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {tc.members.map((mem) => {
                      const inactive =
                        !mem.lastServedAt || Date.now() - new Date(mem.lastServedAt).getTime() > 60 * 864e5;
                      const tag =
                        mem.served90 >= 4 && mem.served90 === top
                          ? { t: "💪 carregando bastante", c: "text-primary" }
                          : inactive
                            ? { t: "😴 dá um alô", c: "text-warning-ink" }
                            : null;
                      return (
                        <li key={mem.personName} className="flex items-center justify-between gap-2 text-sm">
                          <span className="min-w-0 flex-1 truncate">{mem.personName}</span>
                          {tag ? <span className={cn("shrink-0 text-[12px] font-semibold", tag.c)}>{tag.t}</span> : null}
                          <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
                            {mem.served90}× em 90d
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </details>
      ) : null}

      {teamAchv.length > 0 ? (
        <section>
          <h3 className="mb-2 px-1 text-base font-semibold">Conquistas da equipe 🏆</h3>
          <div className="space-y-2">
            {teamAchv.map((t) => (
              <div
                key={t.teamName}
                className="rounded-2xl border border-accent/40 bg-gradient-to-br from-accent/10 to-accent/20 p-4"
              >
                <p className="font-semibold">{t.teamName}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-card px-2.5 py-1 text-xs font-semibold">
                    🎯 {t.fullScales} {t.fullScales > 1 ? "escalas 100% cheias" : "escala 100% cheia"}
                  </span>
                  {t.streak >= 2 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-card px-2.5 py-1 text-xs font-semibold">
                      🔥 {t.streak} seguidas
                    </span>
                  ) : null}
                  {t.thisMonthFull > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-card px-2.5 py-1 text-xs font-semibold">
                      📅 {t.thisMonthFull} este mês
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
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

      {myEventRequests.length > 0 ? (
        <section>
          <h3 className="mb-2 px-1 text-base font-semibold">Seus pedidos de evento</h3>
          <Card>
            <ul className="divide-y divide-border">
              {myEventRequests.map((r) => (
                <li key={r.id} className="flex items-center gap-3 p-4 text-sm">
                  <CalendarPlus className="size-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{r.title}</span>
                    {r.desiredAt ? <span className="text-muted-foreground"> · {fmtEventWhen(r.desiredAt)}</span> : null}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      r.status === "aprovado"
                        ? "bg-success/15 text-success-ink"
                        : r.status === "recusado"
                          ? "bg-muted text-muted-foreground"
                          : "bg-warning/15 text-warning-ink"
                    }`}
                  >
                    {r.status === "aprovado" ? "Aprovado" : r.status === "recusado" ? "Recusado" : "Aguardando"}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
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
  mes,
}: {
  swaps: SwapInboxItem[];
  respEvents: MyResponsibleEvent[];
  mes?: string;
}) {
  const session = (await getSession())!;

  const todayISO = churchDateISO(new Date().toISOString());
  const monthStr = /^\d{4}-\d{2}$/.test(mes ?? "") ? mes! : todayISO.slice(0, 7);
  const y = Number(monthStr.slice(0, 4));
  const m = Number(monthStr.slice(5, 7));
  const fromIso = new Date(`${y}-${pad(m)}-01T00:00:00-03:00`).toISOString();
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const toIso = new Date(`${ny}-${pad(nm)}-01T00:00:00-03:00`).toISOString();
  const prevM = m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
  const nextM = m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );

  const [home, monthEvents, upcoming, eventRequests] = await Promise.all([
    getAdminHome(session),
    listEventsInRange(session, fromIso, toIso),
    listUpcomingEvents(session, 8),
    listPendingEventRequests(),
  ]);
  const eventDayISO: Record<string, string> = Object.fromEntries(
    monthEvents.map((e) => [e.id, churchDateISO(e.starts_at)]),
  );

  return (
    <>
      {/* Calendário do mês — navegável, com "+" pra novo evento */}
      <section>
        <AdminMonthOverview
          year={y}
          month={m}
          events={monthEvents}
          eventDayISO={eventDayISO}
          todayISO={todayISO}
          monthLabel={monthLabel}
          prevM={prevM}
          nextM={nextM}
        />
      </section>

      {/* Aprovações pendentes — acionável */}
      {home.pendingJoinRequests > 0 ? (
        <Link
          href="/pessoas"
          className="flex items-center gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-3.5"
        >
          <span className="inline-flex size-9 items-center justify-center rounded-full bg-warning/15 text-warning-ink">
            <UserPlus className="size-5" />
          </span>
          <span className="flex-1 text-sm font-medium">
            {home.pendingJoinRequests} {home.pendingJoinRequests > 1 ? "pessoas querem" : "pessoa quer"} entrar — toque
            para aprovar
          </span>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
        </Link>
      ) : null}

      {eventRequests.length > 0 ? (
        <Link
          href="/calendario"
          className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-3.5"
        >
          <span className="inline-flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary">
            <CalendarPlus className="size-5" />
          </span>
          <span className="flex-1 text-sm font-medium">
            {eventRequests.length} {eventRequests.length > 1 ? "pedidos de evento" : "pedido de evento"} pra avaliar
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
          <CheckCircle2 className="size-8 text-success-ink" />
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
          <EventPiesCard key={ev.id} ev={ev} />
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
              <AbrirEscala
                eventId={e.eventId}
                className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/50"
              >
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-warning/12 text-warning-ink">
                  <Clock className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{e.title}</p>
                  <p className="text-sm text-muted-foreground">{fmtEventWhen(e.startsAt)} · confirme que vai acontecer</p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
              </AbrirEscala>
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

const QUICK_TILES = [
  { href: "/jornada", emoji: "🏆", label: "Minha Jornada", sub: "Suas conquistas", accent: true },
  { href: "/disponibilidade", emoji: "🗓️", label: "Minhas datas", sub: "Quando não pode" },
  { href: "/historico", emoji: "📋", label: "Histórico", sub: "Onde você serviu" },
  { href: "/notificacoes", emoji: "🔔", label: "Avisos", sub: "Suas notificações" },
];

/** Grid 2×2 de atalhos da home (Home Densa) — agrupa o que eram faixas soltas. */
function QuickTiles() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {QUICK_TILES.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "press rounded-2xl border p-3",
            t.accent ? "border-accent/40 bg-gradient-to-br from-accent/10 to-accent/20" : "border-border bg-card",
          )}
        >
          <div className="text-xl">{t.emoji}</div>
          <p className="mt-1 text-[13.5px] font-bold leading-tight">{t.label}</p>
          <p className="text-[11.5px] text-muted-foreground">{t.sub}</p>
        </Link>
      ))}
    </div>
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
