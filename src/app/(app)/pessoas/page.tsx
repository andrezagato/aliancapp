import { redirect } from "next/navigation";
import { UserPlus, Clock, Mail } from "lucide-react";
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
import { getSession } from "@/lib/auth";
import { listMembers, listPendingJoinRequests, listInvites, listTeams } from "@/lib/data";

export default async function PessoasPage() {
  const session = await getSession();
  if (!session) return null;
  if (session.role !== "admin") redirect("/inicio");

  const [members, joins, invites, teams] = await Promise.all([
    listMembers(),
    listPendingJoinRequests(),
    listInvites(),
    listTeams(),
  ]);

  const teamOpts: TeamOpt[] = teams.map((t) => ({ id: t.id, name: t.name, color: t.color }));
  const active = members.filter((m) => m.status === "ativo");
  const pendingProfiles = members.filter((m) => m.status === "pendente");
  const pendingInvites = invites.filter((i) => i.status === "pendente");

  return (
    <>
      <TopBar title="Pessoas" subtitle="Convites, aprovações e equipes" userName={session.profile.full_name || "?"} />
      <div className="animate-fade-in space-y-6 py-3">
        <ConvidarForm teams={teamOpts} />

        {/* Auto-cadastros aguardando */}
        {joins.length > 0 ? (
          <section>
            <h3 className="mb-2 px-1 text-base font-semibold">Pediram para entrar</h3>
            <div className="space-y-3">
              {joins.map((j) => (
                <Card key={j.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar name={j.fullName} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{j.fullName}</p>
                        {j.email ? <p className="truncate text-sm text-muted-foreground">{j.email}</p> : null}
                        {j.phone ? <p className="text-sm text-muted-foreground">{j.phone}</p> : null}
                        {j.message ? <p className="mt-1 text-sm text-muted-foreground">“{j.message}”</p> : null}
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end border-t border-border/70 pt-3">
                      <JoinRequestActions joinId={j.id} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        {/* Profiles pendentes (logaram sem convite) */}
        {pendingProfiles.length > 0 ? (
          <section>
            <h3 className="mb-2 px-1 text-base font-semibold">Entraram sem convite</h3>
            <div className="space-y-3">
              {pendingProfiles.map((m) => (
                <Card key={m.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={m.fullName} src={m.avatarUrl} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{m.fullName}</p>
                        {m.email ? <p className="truncate text-sm text-muted-foreground">{m.email}</p> : null}
                      </div>
                      <PendingProfileActions profileId={m.id} teams={teamOpts} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        {/* Convites pendentes */}
        {pendingInvites.length > 0 ? (
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

        {/* Membros ativos */}
        <section>
          <h3 className="mb-2 px-1 text-base font-semibold">
            Membros {active.length > 0 ? `· ${active.length}` : ""}
          </h3>
          {active.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-2 px-6 py-8 text-center">
                <UserPlus className="size-8 text-primary" />
                <p className="max-w-xs text-balance text-sm text-muted-foreground">
                  Ninguém ativo ainda. Convide as primeiras pessoas para montar as equipes.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <ul className="divide-y divide-border">
                {active.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 p-4">
                    <Avatar name={m.fullName} src={m.avatarUrl} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {m.fullName}
                        {m.systemRole === "admin" ? <Badge variant="primary" className="ml-2">Admin</Badge> : null}
                      </p>
                      <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                        {m.teams.length === 0 ? (
                          <span className="text-sm text-muted-foreground">Sem equipe</span>
                        ) : (
                          m.teams.map((t, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                              <TeamDot color={t.color} /> {t.name}
                              {t.role === "leader" ? " (líder)" : ""}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      </div>
    </>
  );
}
