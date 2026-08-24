import { TopBar } from "@/components/app-shell/top-bar";
import {
  AdminAddSheet,
  JoinRequestActions,
  PendingProfileActions,
  CancelInviteButton,
  ReconvidarButton,
  EntradaRow,
  type TeamOpt,
} from "@/components/people-controls";
import { Badge } from "@/components/ui/badge";
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
  listStuckEntries,
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
  const lideraIds = new Set(
    session.profile.teams.filter((t) => t.role === "leader").map((t) => t.id),
  );
  const canApprove = isAdmin || isLeader;

  const [teams, members, profiles, resolvedInterests, meuRoster] = await Promise.all([
    getManageableTeams(session),
    listMembers(),
    listChurchProfiles(),
    getResolvedInterests(session),
    // O roster de TODAS as equipes da pessoa, inclusive as que ela só serve.
    // Só leitura por construção — é o mesmo dado que o ramo do voluntário usa.
    getMyTeamsRoster(session),
  ]);

  // Aprovações: admin vê tudo; líder só o que pediu a equipe dele. Convites
  // (criar/cancelar) continuam só pro admin.
  const [joins, pendingProfiles, invites, stuck, allTeams] = await Promise.all([
    canApprove ? listPendingJoinRequests(session) : Promise.resolve([]),
    canApprove ? listPendingProfiles(session) : Promise.resolve([]),
    isAdmin ? listInvites() : Promise.resolve([]),
    canApprove ? listStuckEntries(session) : Promise.resolve([]),
    isAdmin ? listTeams() : Promise.resolve([]),
  ]);
  const teamOpts: TeamOpt[] = allTeams.map((t) => ({ id: t.id, name: t.name, color: t.color }));
  // AS EQUIPES ONDE ELE SÓ SERVE — o caso do Felipe, líder do Som e voluntário
  // no Louvor. Ele é `role === "leader"`, então não entra no ramo do voluntário
  // lá em cima; cai neste, que só mostra o que ele GERENCIA. O Louvor sumia da
  // tela dele em silêncio, sem nem um estado vazio dizendo que ele está numa
  // segunda equipe. A raiz é a assimetria: `session.role` é global, participação
  // é POR EQUIPE.
  //
  // Vem por `getMyTeamsRoster` e vai pro `VolunteerTeamsView`, numa seção à
  // parte — NÃO misturado no TeamManager. A primeira tentativa foi misturar, e a
  // revisão derrubou: o TeamManager desenha "adicionar membro", controles de
  // posição e o menu de cada pessoa POR CARD, e ainda deriva `manageTeamOpts`
  // pro PessoaConfigModal. Toda equipe que entra naquela lista vem com poder
  // junto, e blindar só a lista de aprovação deixava as outras abertas. Separar
  // é mais simples E mais seguro que gatear permissão card a card.
  const soServe = meuRoster.filter((t) => !lideraIds.has(t.id));

  const approvalTeamOpts: TeamOpt[] = isAdmin
    ? teamOpts
    : teams.map((t) => ({ id: t.id, name: t.name, color: t.color }));
  const teamById = new Map(approvalTeamOpts.map((t) => [t.id, t]));
  // A LINHA MORTA VOLTA, ROTULADA. Eu tinha escondido convite pendente de quem
  // já é membro ("fila com linha morta dentro deixa de ser lida") — e esconder
  // criou um beco sem saída: o `CancelInviteButton` só existe a partir desta
  // lista, então a linha ficava invisível E incancelável. Ela nunca se resolve
  // sozinha (o `handle_new_user` só roda no signup, e o `reconciliar_onboarding`
  // sai cedo pra quem já está ativo), e o `criarConvite` manda "cancele em
  // Equipes" apontando pra um botão que não estava lá.
  //
  // Rotular resolve os dois: some do caminho de leitura (o selo diz que não é
  // gente chegando) e continua acionável.
  const pendingInvites = invites.filter((i) => i.status === "pendente");

  // "Entrando na igreja" — pedido de entrada, perfil pendente e convite são a
  // mesma coisa vista de fora (gente chegando); a origem vira texto na 2ª
  // linha, não uma seção própria.
  // TRAVADOS PRIMEIRO. As outras linhas são "decida sobre esta pessoa"; estas
  // são "você já decidiu e não chegou nela". Enterrar isso no fim da lista
  // repetiria o defeito que ela conserta — o problema estava visível, só que
  // longe demais pra alguém tropeçar nele.
  const entradaRows = [
    ...stuck.map((s) => {
      const team = s.desiredTeamId ? teamById.get(s.desiredTeamId) : null;
      const espera = s.diasParado === 0 ? "hoje" : `há ${s.diasParado} ${s.diasParado === 1 ? "dia" : "dias"}`;
      return {
        id: s.id,
        fullName: s.fullName,
        email: s.email,
        phone: null as string | null,
        message: null as string | null,
        teamDot: team?.color ?? null,
        chip: <Badge variant="warning">Travado</Badge>,
        // O motivo em português, porque "por que travou" é o que decide se
        // Reconvidar basta ou se é caso de ligar pra pessoa.
        line2: [
          team ? `Quer ${team.name}` : null,
          s.motivo === "link_vencido"
            ? `o link venceu · aprovado ${espera}`
            : `sem convite ativo · aprovado ${espera}`,
        ]
          .filter(Boolean)
          .join(" · "),
        actions: <ReconvidarButton alvo={s.alvo} />,
      };
    }),
    ...joins.map((j) => {
      const team = j.desiredTeamId ? teamById.get(j.desiredTeamId) : null;
      return {
        id: `j-${j.id}`,
        fullName: j.fullName,
        email: j.email,
        phone: j.phone,
        message: j.message,
        teamDot: team?.color ?? null,
        line2: [team ? `Quer ${team.name}` : null, "pelo formulário"].filter(Boolean).join(" · "),
        actions: <JoinRequestActions joinId={j.id} teams={approvalTeamOpts} desiredTeamId={j.desiredTeamId} />,
      };
    }),
    ...pendingProfiles.map((m) => {
      const team = m.desiredTeamId ? teamById.get(m.desiredTeamId) : null;
      return {
        id: `p-${m.id}`,
        fullName: m.fullName,
        avatarUrl: m.avatarUrl,
        email: m.email,
        phone: null as string | null,
        message: null as string | null,
        teamDot: team?.color ?? null,
        line2: [team ? `Quer ${team.name}` : null, "já logou · aguardando"].filter(Boolean).join(" · "),
        actions: (
          <PendingProfileActions profileId={m.id} teams={approvalTeamOpts} allowReject={isAdmin} desiredTeamId={m.desiredTeamId} />
        ),
      };
    }),
    ...(isAdmin
      ? pendingInvites.map((i) => {
          const teamsText = i.teams.length > 0 ? i.teams.map((t) => t.name).join(", ") : null;
          const origem = i.jaEntrou
            ? "já é membro · este convite não vale mais"
            : i.diasEsperando === 0
              ? "convidado hoje"
              : `convidado há ${i.diasEsperando} ${i.diasEsperando === 1 ? "dia" : "dias"}`;
          return {
            id: `i-${i.id}`,
            fullName: i.fullName || i.email,
            email: i.email,
            phone: null as string | null,
            message: null as string | null,
            teamDot: i.teams[0]?.color ?? null,
            chip: i.jaEntrou ? <Badge variant="neutral">Linha morta</Badge> : undefined,
            line2: [teamsText, i.systemRole === "admin" ? "admin" : null, origem].filter(Boolean).join(" · "),
            actions: <CancelInviteButton inviteId={i.id} />,
          };
        })
      : []),
  ];

  return (
    <>
      <TopBar
        title="Equipes"
        subtitle={isAdmin ? "Gente, equipes e convites" : "Sua equipe"}
        userName={session.profile.full_name || "?"}
        action={isAdmin ? <AdminAddSheet teams={teamOpts} /> : null}
      />
      <div className="animate-fade-in space-y-6 py-3">
        {entradaRows.length > 0 ? (
          <section>
            <h3 className="mb-2 px-1 text-base font-semibold">Entrando na igreja · {entradaRows.length}</h3>
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
              <div className="divide-y divide-border/70">
                {entradaRows.map((row) => <EntradaRow key={row.id} {...row} />)}
              </div>
            </div>
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

        {soServe.length > 0 ? (
          <section>
            <h3 className="mb-2 px-1 text-base font-semibold">Você também serve em</h3>
            <VolunteerTeamsView teams={soServe} meId={session.userId} />
          </section>
        ) : null}

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
                        i.status === "atendido" ? "bg-success/15 text-success-ink" : "bg-muted text-muted-foreground"
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
