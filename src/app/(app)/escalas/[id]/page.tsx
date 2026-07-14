import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MapPin, Clock, CircleDashed, CircleSlash } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { CoverageBadge, TeamDot } from "@/components/coverage-badge";
import { AssignmentResponse } from "@/components/assignment-response";
import {
  EscalarDialog,
  RemoveAssignmentButton,
  NaoSeAplicaToggle,
  NecessarioStepper,
  AdicionarEquipe,
} from "@/components/leader-controls";
import { STATUS_META } from "@/lib/status";
import { getSession } from "@/lib/auth";
import { getEventDetail, listChurchProfiles, type DetailPosition, type DetailTeam } from "@/lib/data";
import { CheckinButton, SwapPending } from "@/components/slot-controls";
import { ResponsavelControls } from "@/components/responsavel-controls";
import { fmtEventDate, fmtTime, churchDateISO } from "@/lib/format";

export default async function EventoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return null;
  const ev = await getEventDetail(session, id);
  if (!ev) notFound();

  // Check-in liberado no dia do evento (ou depois).
  const nowISO = new Date().toISOString();
  const canCheckin = churchDateISO(ev.starts_at) <= churchDateISO(nowISO);
  const kicker = churchDateISO(ev.starts_at) === churchDateISO(nowISO) ? "Acontece hoje" : "Próximo culto";
  const hasMeta = !!(ev.responsibleName || session.role === "admin" || ev.notes);
  const profiles = session.role === "admin" ? await listChurchProfiles() : [];

  return (
    <div className="space-y-3.5 pb-4">
      <Link
        href="/escalas"
        className="press -ml-1 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[15px] font-bold text-primary"
      >
        <ChevronLeft className="size-5" /> Escalas
      </Link>

      {/* Cabeçalho vinho do evento */}
      <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[hsl(349_72%_28%)] to-[hsl(349_69%_15%)] p-5 text-primary-foreground shadow-lift">
        <div
          className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full"
          style={{ background: "radial-gradient(circle, hsl(var(--accent) / 0.4), transparent 68%)" }}
          aria-hidden
        />
        <div className="relative">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-accent">{kicker}</p>
          <h1 className="mt-1 font-display text-[27px] font-extrabold leading-[1.05] text-white">{ev.title}</h1>
          <p className="mt-1 text-[13.5px] capitalize text-primary-foreground/85">{fmtEventDate(ev.starts_at)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[13.5px] text-primary-foreground/85">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5 text-accent" /> {fmtTime(ev.starts_at)}
              {ev.ends_at ? ` – ${fmtTime(ev.ends_at)}` : ""}
            </span>
            {ev.location ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5 text-accent" /> {ev.location}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {hasMeta ? (
        <Card>
          <CardContent className="space-y-2 p-4">
            {ev.responsibleName || session.role === "admin" ? (
              <ResponsavelControls
                eventId={ev.id}
                isAdmin={session.role === "admin"}
                isResponsible={ev.isResponsible}
                responsibleName={ev.responsibleName}
                confirmedAt={ev.confirmedAt}
                profiles={profiles}
              />
            ) : null}
            {ev.notes ? <p className="text-sm text-muted-foreground">{ev.notes}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {ev.teams.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="px-6 py-10 text-center text-sm text-muted-foreground">
            Nenhuma equipe da sua visão tem escala neste evento.
          </CardContent>
        </Card>
      ) : (
        ev.teams.map((team) => (
          <TeamBlock key={team.teamId} eventId={ev.id} team={team} canCheckin={canCheckin} />
        ))
      )}

      {session.role === "admin" && ev.addableTeams.length > 0 ? (
        <Card className="border-dashed">
          <div className="p-4">
            <AdicionarEquipe eventId={ev.id} teams={ev.addableTeams} />
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function TeamBlock({
  eventId,
  team,
  canCheckin,
}: {
  eventId: string;
  team: DetailTeam;
  canCheckin: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-border p-4">
        <TeamDot color={team.color} className="size-3" />
        <h2 className="font-display text-[17px] font-bold">{team.name}</h2>
        <CoverageBadge tone={team.tone} assigned={team.assigned} needed={team.needed} className="ml-auto" />
      </div>
      <ul className="divide-y divide-border/70">
        {team.positions.map((pos) => (
          <li key={pos.positionId} className="p-4">
            <PositionRow eventId={eventId} team={team} pos={pos} canCheckin={canCheckin} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function PositionRow({
  eventId,
  team,
  pos,
  canCheckin,
}: {
  eventId: string;
  team: DetailTeam;
  pos: DetailPosition;
  canCheckin: boolean;
}) {
  const notApplicable = pos.status === "not_applicable";

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          {pos.positionName}
          {!notApplicable && !team.canManage && pos.needed > 1 ? (
            <span className="ml-1 font-normal text-muted-foreground">· {pos.needed} pessoas</span>
          ) : null}
        </p>
        {team.canManage ? (
          <div className="flex items-center gap-3">
            {!notApplicable ? (
              <NecessarioStepper
                requirementId={pos.requirementId!}
                eventId={eventId}
                teamId={team.teamId}
                needed={pos.needed}
              />
            ) : null}
            <NaoSeAplicaToggle
              requirementId={pos.requirementId!}
              eventId={eventId}
              teamId={team.teamId}
              naoSeAplica={notApplicable}
            />
          </div>
        ) : null}
      </div>

      {notApplicable ? (
        <p className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          <CircleSlash className="size-3.5" /> Não se aplica neste evento
          {pos.note ? ` — ${pos.note}` : ""}
        </p>
      ) : (
        <div className="space-y-2">
          {pos.filled.map((person) => {
            const meta = STATUS_META[person.status];
            const showResponse =
              person.isMe && !person.swap && (person.status === "convidado" || person.status === "confirmado");
            return (
              <div key={person.assignmentId} className="space-y-2">
                <div className="flex items-center gap-3">
                  <Avatar name={person.name} src={person.avatarUrl} className="size-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {person.name}
                      {person.isMe ? <span className="text-muted-foreground"> (você)</span> : null}
                    </p>
                    {person.status === "recusado" && person.declineReason ? (
                      <p className="truncate text-xs text-muted-foreground">Recusou: {person.declineReason}</p>
                    ) : null}
                  </div>
                  {showResponse ? (
                    <AssignmentResponse assignmentId={person.assignmentId} status={person.status} teamId={team.teamId} />
                  ) : (
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  )}
                  {team.canManage ? (
                    <RemoveAssignmentButton assignmentId={person.assignmentId} eventId={eventId} teamId={team.teamId} />
                  ) : null}
                </div>

                {canCheckin && person.status !== "recusado" ? (
                  <div className="pl-12">
                    <CheckinButton
                      assignmentId={person.assignmentId}
                      teamId={team.teamId}
                      eventId={eventId}
                      checkedIn={person.checkedIn}
                      canMark={person.isMe || team.canManage}
                    />
                  </div>
                ) : null}

                {person.swap ? (
                  <div className="pl-12">
                    <SwapPending
                      swapId={person.swap.id}
                      eventId={eventId}
                      reason={person.swap.reason}
                      suggestedName={person.swap.suggestedName}
                      acceptedBySub={person.swap.acceptedBySub}
                      canManage={team.canManage}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}

          {pos.openCount > 0 ? (
            team.canManage ? (
              <EscalarDialog
                eventId={eventId}
                teamId={team.teamId}
                positionId={pos.positionId}
                requirementId={pos.requirementId}
                positionName={pos.positionName}
                openCount={pos.openCount}
              />
            ) : (
              <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <CircleDashed className="size-4 text-primary" />
                {pos.openCount} vaga{pos.openCount > 1 ? "s" : ""} em aberto
              </p>
            )
          ) : null}
        </div>
      )}
    </div>
  );
}
