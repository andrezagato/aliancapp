import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Clock, CircleDashed, CircleSlash } from "lucide-react";
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
  const canCheckin = churchDateISO(ev.starts_at) <= churchDateISO(new Date().toISOString());
  const profiles = session.role === "admin" ? await listChurchProfiles() : [];

  return (
    <div className="animate-fade-in space-y-4 py-3">
      <Link href="/escalas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Escalas
      </Link>

      {/* Cabeçalho do evento */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/10 to-card">
        <CardContent className="p-5">
          <h1 className="text-2xl font-semibold">{ev.title}</h1>
          <p className="mt-1 capitalize text-muted-foreground">{fmtEventDate(ev.starts_at)}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4" /> {fmtTime(ev.starts_at)}
              {ev.ends_at ? ` – ${fmtTime(ev.ends_at)}` : ""}
            </span>
            {ev.location ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" /> {ev.location}
              </span>
            ) : null}
          </div>
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
          {ev.notes ? <p className="mt-2 text-sm text-muted-foreground">{ev.notes}</p> : null}
        </CardContent>
      </Card>

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
    <Card>
      <div className="flex items-center justify-between gap-2 border-b border-border p-4">
        <div className="flex items-center gap-2">
          <TeamDot color={team.color} className="size-3" />
          <h2 className="text-lg font-semibold">{team.name}</h2>
        </div>
        <CoverageBadge tone={team.tone} assigned={team.assigned} needed={team.needed} />
      </div>
      <ul className="divide-y divide-border">
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
