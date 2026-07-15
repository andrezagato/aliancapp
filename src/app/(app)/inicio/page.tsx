import Link from "next/link";
import {
  MapPin,
  CalendarDays,
  ChevronRight,
  CircleDashed,
  Clock,
  Sparkles,
  Cake,
  UserPlus,
  Plus,
  AlertTriangle,
  CheckCircle2,
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
  listTeamsWithPositions,
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
import { InteresseButton, InteresseResolveButtons } from "@/components/interesse-controls";
import { VolunteerHome } from "@/components/home/volunteer-home";

function greeting() {
  const h = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date()));
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function InicioPage() {
  const session = await getSession();
  if (!session) return null;

  const [swaps, respEvents, myInterests, teamsWithPos] = await Promise.all([
    getSwapsAwaitingMe(session),
    getEventsAwaitingMyConfirmation(session),
    getMyOpenInterests(session),
    listTeamsWithPositions(),
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

  // Voluntário: experiência "Aconchego" completa (cabeçalho reativo,
  // pull-to-refresh, herói, swipe). Os blocos extras entram como children.
  if (session.role === "volunteer") {
    const mine = await getMyUpcomingAssignments(session);
    return (
      <VolunteerHome title={`${greeting()}, ${first}`} subtitle={roleLabel} userName={userName} assignments={mine}>
        <SwapInbox items={swaps} />
        <ResponsibleConfirm events={respEvents} />
        <Servir teams={teamsWithPos} interests={myInterests} />
        <Birthdays />
      </VolunteerHome>
    );
  }

  // Admin: home reorganizada — herói no topo, pendências, resumo clicável abaixo.
  if (session.role === "admin") {
    return (
      <HomeShell title={`${greeting()}, ${first}`} subtitle={roleLabel} userName={userName}>
        <AdminSection swaps={swaps} respEvents={respEvents} />
        <Servir teams={teamsWithPos} interests={myInterests} />
        <Birthdays />
      </HomeShell>
    );
  }

  // Líder: casca "Aconchego" (cabeçalho reativo + pull-to-refresh).
  return (
    <HomeShell title={`${greeting()}, ${first}`} subtitle={roleLabel} userName={userName}>
      <SwapInbox items={swaps} />
      <ResponsibleConfirm events={respEvents} />
      <LeaderSection />
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
async function LeaderSection() {
  const session = (await getSession())!;
  const [home, mine] = await Promise.all([getLeaderHome(session), getMyUpcomingAssignments(session)]);

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <StatTile icon={<CircleDashed className="size-5" />} value={home.openVacancies} label="Vagas abertas" tone="primary" />
        <StatTile icon={<Clock className="size-5" />} value={home.awaitingConfirmation} label="Aguardando" tone="warning" />
        <StatTile icon={<Sparkles className="size-5" />} value={home.interests.length} label="Interesses" tone="accent" />
      </div>

      <EventsWithCoverage events={home.events} title="Próximos eventos" emptyHint="Nenhum evento à frente. Peça ao admin para criar o próximo culto." />

      {home.interests.length > 0 ? (
        <section>
          <h3 className="mb-2 px-1 text-base font-semibold">Interesse em servir</h3>
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
                      <InteresseResolveButtons id={i.id} teamId={i.teamId} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      {mine.length > 0 ? <MyScheduleList mine={mine} title="Suas escalas" /> : null}
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
  const home = await getAdminHome(session);

  return (
    <>
      {/* 1. Herói — o próximo culto é a âncora da tela */}
      {home.nextEvent ? <NextEventCard ev={home.nextEvent} /> : null}

      {/* 2. Ações principais */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/escalas/novo" className={cn(buttonVariants(), "w-full")}>
          <Plus className="size-4" /> Criar evento
        </Link>
        <Link href="/pessoas" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
          <UserPlus className="size-4" /> Convidar
        </Link>
      </div>

      {/* 3. Precisa de você — pendências acionáveis */}
      <SwapInbox items={swaps} />
      <ResponsibleConfirm events={respEvents} />

      {home.coverageHoles.length > 0 ? (
        <section>
          <h3 className="mb-2 px-1 text-base font-semibold">Precisam de escala</h3>
          <Card>
            <ul className="divide-y divide-border">
              {home.coverageHoles.map((h) => (
                <li key={h.eventId}>
                  <Link href={`/escalas/${h.eventId}`} className="flex items-center gap-3 p-4 hover:bg-muted/50">
                    <span className="inline-flex size-10 items-center justify-center rounded-full bg-destructive/12 text-destructive">
                      <AlertTriangle className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{h.title}</p>
                      <p className="text-sm text-muted-foreground">{fmtEventWhen(h.startsAt)}</p>
                    </div>
                    <Badge variant="danger">{h.missing} vaga{h.missing > 1 ? "s" : ""}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      {home.awaitingResponsible.length > 0 ? (
        <section>
          <h3 className="mb-2 px-1 text-base font-semibold">Aguardando confirmação do responsável</h3>
          <Card>
            <ul className="divide-y divide-border">
              {home.awaitingResponsible.map((e) => (
                <li key={e.eventId} className="flex items-center gap-3 p-4">
                  <span className="inline-flex size-10 items-center justify-center rounded-full bg-warning/12 text-warning">
                    <Clock className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{e.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {e.responsibleName ? `${e.responsibleName} · ` : ""}
                      {fmtEventWhen(e.startsAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      {/* 4. Resumo — atalhos clicáveis (não pedem ação, ficam por último) */}
      <section>
        <h3 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">Resumo</h3>
        <div className="grid grid-cols-3 gap-3">
          <Link href="/pessoas" className="contents">
            <StatTile icon={<UserPlus className="size-5" />} value={home.pendingJoinRequests} label="Aprovações" tone="warning" />
          </Link>
          <Link href="/escalas" className="contents">
            <StatTile icon={<CalendarDays className="size-5" />} value={home.upcomingCount} label="Eventos" tone="primary" />
          </Link>
          <Link href="/escalas" className="contents">
            <StatTile icon={<AlertTriangle className="size-5" />} value={home.coverageHoles.length} label="Sem escala" tone="accent" />
          </Link>
        </div>
      </section>
    </>
  );
}

// -----------------------------------------------------------------------------
// COMPARTILHADOS
// -----------------------------------------------------------------------------
function NextEventCard({ ev }: { ev: EventListItem }) {
  const pct = ev.neededTotal > 0 ? Math.round((ev.assignedTotal / ev.neededTotal) * 100) : 100;
  return (
    <div className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-primary to-[hsl(349_74%_19%)] p-5 text-primary-foreground shadow-lift">
      <div
        className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full opacity-70"
        style={{ background: "radial-gradient(circle, hsl(var(--accent) / 0.45), transparent 70%)" }}
      />
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">Próximo culto</p>
        <h2 className="mt-1 text-2xl font-bold text-white">{ev.title}</h2>
        <p className="mt-0.5 text-sm text-primary-foreground/80">
          <span className="capitalize">{fmtEventWhen(ev.starts_at)}</span>
          {ev.location ? ` · ${ev.location}` : ""}
        </p>

        <div className="mt-4 flex items-center gap-3">
          <div
            className="grid size-14 place-items-center rounded-full"
            style={{ background: `conic-gradient(hsl(var(--accent)) ${pct}%, hsl(0 0% 100% / 0.18) 0)` }}
          >
            <span className="grid size-10 place-items-center rounded-full bg-[hsl(349_74%_17%)] text-xs font-bold tabular-nums">
              {ev.assignedTotal}/{ev.neededTotal}
            </span>
          </div>
          <p className="text-xs leading-tight text-primary-foreground/80">
            confirmados
            <br />
            na sua equipe
          </p>
          <Link href={`/escalas/${ev.id}`} className={cn(buttonVariants({ variant: "accent", size: "sm" }), "ml-auto press")}>
            Abrir escala
          </Link>
        </div>

        {ev.teams.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {ev.teams.map((t) => (
              <span
                key={t.teamId}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1 text-xs font-medium"
              >
                <span
                  className={cn(
                    "size-2 rounded-full",
                    t.tone === "full" ? "bg-success" : t.tone === "partial" ? "bg-warning" : "bg-destructive",
                  )}
                  style={t.tone === "empty" ? { backgroundColor: "hsl(6 80% 66%)" } : undefined}
                />
                {t.name} {t.assigned}/{t.needed}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function EventsWithCoverage({
  events,
  title,
  emptyHint,
}: {
  events: EventListItem[];
  title: string;
  emptyHint: string;
}) {
  if (events.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-2 px-6 py-8 text-center">
          <CheckCircle2 className="size-8 text-success" />
          <p className="max-w-xs text-balance text-sm text-muted-foreground">{emptyHint}</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <section>
      <h3 className="mb-2 px-1 text-base font-semibold">{title}</h3>
      <div className="space-y-3">
        {events.map((ev) => (
          <Card key={ev.id}>
            <Link href={`/escalas/${ev.id}`} className="block p-4 hover:bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{ev.title}</p>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">{fmtEventWhen(ev.starts_at)}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ev.teams.map((t) => (
                  <CoverageBadge key={t.teamId} tone={t.tone} label={`${t.name} ${t.assigned}/${t.needed}`} />
                ))}
              </div>
            </Link>
          </Card>
        ))}
      </div>
    </section>
  );
}

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

function StatTile({
  icon,
  value,
  label,
  tone,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  tone: "primary" | "warning" | "accent";
}) {
  const toneClass =
    tone === "primary"
      ? "text-primary bg-primary/10"
      : tone === "warning"
        ? "text-warning bg-warning/12"
        : "text-accent bg-accent/12";
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-1 p-3 text-center">
        <span className={`inline-flex size-9 items-center justify-center rounded-full ${toneClass}`}>{icon}</span>
        <span className="font-display text-2xl font-extrabold leading-none">{value}</span>
        <span className="text-[11px] leading-tight text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  );
}
