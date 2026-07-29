import { Clock, Mail } from "lucide-react";
import { TopBar } from "@/components/app-shell/top-bar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { TeamDot } from "@/components/coverage-badge";
import {
  ConvidarForm,
  JoinRequestActions,
  PendingProfileActions,
  CancelInviteButton,
  type TeamOpt,
} from "@/components/people-controls";
import { TeamManager } from "@/components/team-manager";
import { getSession } from "@/lib/auth";
import {
  getManageableTeams,
  getMyTeamsRoster,
  getResolvedInterests,
  listMembers,
  listChurchProfiles,
  listPendingJoinRequests,
  listPendingProfiles,
  listInvites,
  listTeams,
} from "@/lib/data";
import { VolunteerTeamsView } from "@/components/volunteer-teams-view";

export default async function EquipesPage() {
  const session = await getSession();
  if (!session) return null;

  // Voluntário: visão só-leitura de quem serve com ele (pra comunicação).
  if (session.role === "volunteer") {
    const roster = await getMyTeamsRoster(session);
    return (
      <>
        <TopBar title="Equipes" subtitle="Quem serve com você" userName={session.profile.full_name || "?"} />
        <div className="animate-fade-in space-y-3 py-3">
          <VolunteerTeamsView teams={roster} meId={session.userId} />
        </div>
      </>
    );
  }

  // Admin gerencia tudo; líder gerencia as equipes que lidera.
  const isAdmin = session.role === "admin";
  const isLeader = session.role === "leader";
  const canApprove = isAdmin || isLeader;

  const [teams, members, profiles, resolvedInterests] = await Promise.all([
    getManageableTeams(session),
    listMembers(),
    listChurchProfiles(),
    getResolvedInterests(session),
  ]);

  // Aprovações: admin vê tudo; líder só o que pediu a equipe dele. Convites
  // (criar/cancelar) continuam só pro admin.
  const [joins, pendingProfiles, invites, allTeams] = await Promise.all([
    canApprove ? listPendingJoinRequests(session) : Promise.resolve([]),
    canApprove ? listPendingProfiles(session) : Promise.resolve([]),
    isAdmin ? listInvites() : Promise.resolve([]),
    isAdmin ? listTeams() : Promise.resolve([]),
  ]);
  const teamOpts: TeamOpt[] = allTeams.map((t) => ({ id: t.id, name: t.name, color: t.color }));
  const approvalTeamOpts: TeamOpt[] = isAdmin
    ? teamOpts
    : teams.map((t) => ({ id: t.id, name: t.name, color: t.color }));
  const teamById = new Map(approvalTeamOpts.map((t) => [t.id, t]));
  const pendingInvites = invites.filter((i) => i.status === "pendente");

  return (
    <>
      <TopBar
        title="Equipes"
        subtitle={isAdmin ? "Gente, equipes e convites" : "Sua equipe"}
        userName={session.profile.full_name || "?"}
      />
      <div className="animate-fade-in space-y-6 py-3">
        {isAdmin ? <ConvidarForm teams={teamOpts} /> : null}

        {canApprove && joins.length + pendingProfiles.length > 0 ? (
          <section>
            <h3 className="mb-2 px-1 text-base font-semibold">
              Querem entrar · {joins.length + pendingProfiles.length}
            </h3>
            <div className="grid gap-3 lg:grid-cols-2">
              {joins.map((j) => (
                <Card key={`j-${j.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar name={j.fullName} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{j.fullName}</p>
                        <Badge variant="neutral" className="mt-0.5">Pediu pelo formulário</Badge>
                        {j.desiredTeamId && teamById.get(j.desiredTeamId) ? (
                          <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                            <TeamDot color={teamById.get(j.desiredTeamId)!.color} />
                            Quer servir em {teamById.get(j.desiredTeamId)!.name}
                          </p>
                        ) : null}
                        {j.email ? <p className="mt-1 truncate text-sm text-muted-foreground">{j.email}</p> : null}
                        {j.phone ? <p className="text-sm text-muted-foreground">{j.phone}</p> : null}
                        {j.message ? <p className="mt-1 text-sm text-muted-foreground">“{j.message}”</p> : null}
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end border-t border-border/70 pt-3">
                      <JoinRequestActions joinId={j.id} teams={approvalTeamOpts} desiredTeamId={j.desiredTeamId} />
                    </div>
                  </CardContent>
                </Card>
              ))}
              {pendingProfiles.map((m) => (
                <Card key={`p-${m.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={m.fullName} src={m.avatarUrl} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{m.fullName}</p>
                        <Badge variant="neutral" className="mt-0.5">Já logou · aguardando</Badge>
                        {m.desiredTeamId && teamById.get(m.desiredTeamId) ? (
                          <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                            <TeamDot color={teamById.get(m.desiredTeamId)!.color} />
                            Quer servir em {teamById.get(m.desiredTeamId)!.name}
                          </p>
                        ) : null}
                        {m.email ? <p className="mt-1 truncate text-sm text-muted-foreground">{m.email}</p> : null}
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end border-t border-border/70 pt-3">
                      <PendingProfileActions
                        profileId={m.id}
                        teams={approvalTeamOpts}
                        allowReject={isAdmin}
                        desiredTeamId={m.desiredTeamId}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        {isAdmin && pendingInvites.length > 0 ? (
          <section>
            <h3 className="mb-2 px-1 text-base font-semibold">Convites pendentes</h3>
            <Card>
              <ul className="divide-y divide-border">
                {pendingInvites.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 p-4">
                    <span className="inline-flex size-10 items-center justify-center rounded-full bg-warning/12 text-warning">
                      <Clock className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{i.fullName || i.email}</p>
                      <p className="inline-flex items-center gap-1 truncate text-sm text-muted-foreground">
                        <Mail className="size-3" /> {i.email}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {i.systemRole === "admin" ? <Badge variant="primary">Admin</Badge> : null}
                        {i.teams.map((t, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <TeamDot color={t.color} /> {t.name}
                            {t.role === "leader" ? " (líder)" : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                    <CancelInviteButton inviteId={i.id} />
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        ) : null}

        <TeamManager
          teams={teams}
          members={members}
          allProfiles={profiles}
          isAdmin={isAdmin}
          meId={session.userId}
          canCreateTeam={isAdmin}
        />

        {resolvedInterests.length > 0 ? (
          <details className="rounded-2xl border border-border bg-card">
            <summary className="flex cursor-pointer items-center justify-between p-4 text-sm font-semibold">
              Histórico de pedidos de servir
              <span className="text-xs font-medium text-muted-foreground">{resolvedInterests.length}</span>
            </summary>
            <ul className="divide-y divide-border border-t border-border">
              {resolvedInterests.map((i) => (
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
      </div>
    </>
  );
}
