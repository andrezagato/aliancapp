import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  coverageByTeam,
  coverageTone,
  occupies,
  CONFIRMED,
  type CoverageTone,
  type ReqRow,
  type AssignRow,
} from "@/lib/coverage";
import {
  type Session,
  memberTeamIds,
} from "@/lib/auth";
import type { AssignmentStatus, RequirementStatus } from "@/lib/supabase/database.types";

// Eventos a partir de ~12h atrás (mantém culto do dia visível).
function upcomingCutoffIso(): string {
  return new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
}

/** Equipes cuja escala o usuário pode ver. Admin vê todas (null = sem filtro). */
function visibleTeamIds(session: Session): string[] | null {
  if (session.role === "admin") return null;
  return memberTeamIds(session.profile);
}

// =============================================================================
// EQUIPES / POSIÇÕES
// =============================================================================
export type TeamMeta = {
  id: string;
  name: string;
  color: string;
  icon: string;
  sort_order: number;
};

export type PositionMeta = {
  id: string;
  team_id: string;
  name: string;
  sort_order: number;
};

export async function listTeams(): Promise<TeamMeta[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("teams")
    .select("id, name, color, icon, sort_order")
    .is("archived_at", null)
    .order("sort_order");
  return data ?? [];
}

export type TeamWithPositions = TeamMeta & { positions: PositionMeta[] };

export async function listTeamsWithPositions(): Promise<TeamWithPositions[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("teams")
    .select("id, name, color, icon, sort_order, positions ( id, team_id, name, sort_order, archived_at )")
    .is("archived_at", null)
    .order("sort_order");
  return (data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    icon: t.icon,
    sort_order: t.sort_order,
    positions: ((t.positions ?? []) as (PositionMeta & { archived_at: string | null })[])
      .filter((p) => !p.archived_at)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((p) => ({ id: p.id, team_id: p.team_id, name: p.name, sort_order: p.sort_order })),
  }));
}

// =============================================================================
// LISTA DE EVENTOS (com cobertura por equipe)
// =============================================================================
export type EventTeamCoverage = {
  teamId: string;
  name: string;
  color: string;
  needed: number;
  assigned: number;
  confirmed: number;
  tone: CoverageTone;
};

export type EventListItem = {
  id: string;
  title: string;
  starts_at: string;
  location: string | null;
  seriesId: string | null;
  teams: EventTeamCoverage[];
  overallTone: CoverageTone;
  neededTotal: number;
  assignedTotal: number;
};

export async function listUpcomingEvents(session: Session, limit = 50): Promise<EventListItem[]> {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("id, title, starts_at, location, series_id")
    .gte("starts_at", upcomingCutoffIso())
    .order("starts_at", { ascending: true })
    .limit(limit);

  if (!events || events.length === 0) return [];
  const eventIds = events.map((e) => e.id);

  const [{ data: reqs }, { data: assigns }, teams] = await Promise.all([
    supabase
      .from("event_requirements")
      .select("id, event_id, team_id, position_id, needed_count, status")
      .in("event_id", eventIds),
    supabase
      .from("assignments")
      .select("id, event_id, team_id, position_id, profile_id, status")
      .in("event_id", eventIds),
    listTeams(),
  ]);

  const teamMeta = new Map(teams.map((t) => [t.id, t]));
  const visible = visibleTeamIds(session);
  const canSee = (teamId: string) => visible === null || visible.includes(teamId);

  return events.map((ev) => {
    const evReqs = (reqs ?? []).filter((r) => r.event_id === ev.id) as ReqRow[];
    const evAssigns = (assigns ?? []).filter((a) => a.event_id === ev.id) as AssignRow[];
    const perTeam = coverageByTeam(evReqs, evAssigns);

    const teamCov: EventTeamCoverage[] = [];
    let neededTotal = 0;
    let assignedTotal = 0;
    for (const [teamId, cov] of perTeam) {
      if (!canSee(teamId)) continue;
      const meta = teamMeta.get(teamId);
      if (!meta) continue;
      neededTotal += cov.needed;
      assignedTotal += cov.assigned;
      teamCov.push({
        teamId,
        name: meta.name,
        color: meta.color,
        needed: cov.needed,
        assigned: cov.assigned,
        confirmed: cov.confirmed,
        tone: cov.tone,
      });
    }
    teamCov.sort((a, b) => (teamMeta.get(a.teamId)?.sort_order ?? 0) - (teamMeta.get(b.teamId)?.sort_order ?? 0));

    return {
      id: ev.id,
      title: ev.title,
      starts_at: ev.starts_at,
      location: ev.location,
      seriesId: ev.series_id,
      teams: teamCov,
      overallTone: coverageTone(neededTotal, assignedTotal),
      neededTotal,
      assignedTotal,
    };
  });
}

// =============================================================================
// DETALHE DO EVENTO (agrupado por equipe -> posição -> vagas)
// =============================================================================
export type SlotPerson = {
  assignmentId: string;
  profileId: string | null;
  name: string;
  avatarUrl: string | null;
  status: AssignmentStatus;
  declineReason: string | null;
  isMe: boolean;
};

export type DetailPosition = {
  requirementId: string | null;
  positionId: string;
  positionName: string;
  needed: number;
  status: RequirementStatus;
  note: string | null;
  filled: SlotPerson[];
  openCount: number;
};

export type DetailTeam = {
  teamId: string;
  name: string;
  color: string;
  icon: string;
  canManage: boolean;
  needed: number;
  assigned: number;
  confirmed: number;
  tone: CoverageTone;
  positions: DetailPosition[];
};

export type EventDetail = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  notes: string | null;
  seriesId: string | null;
  responsibleId: string | null;
  responsibleName: string | null;
  confirmedAt: string | null;
  teams: DetailTeam[];
};

export async function getEventDetail(session: Session, eventId: string): Promise<EventDetail | null> {
  const supabase = await createClient();
  const { data: ev } = await supabase
    .from("events")
    .select(
      "id, title, starts_at, ends_at, location, notes, series_id, responsible_id, confirmed_at, responsible:profiles!events_responsible_id_fkey ( full_name )",
    )
    .eq("id", eventId)
    .maybeSingle();
  if (!ev) return null;

  const [{ data: reqs }, { data: assigns }, teams] = await Promise.all([
    supabase
      .from("event_requirements")
      .select("id, team_id, position_id, needed_count, status, note, position:positions ( name, sort_order )")
      .eq("event_id", eventId),
    supabase
      .from("assignments")
      .select(
        "id, team_id, position_id, profile_id, status, decline_reason, profile:profiles!assignments_profile_id_fkey ( full_name, avatar_url )",
      )
      .eq("event_id", eventId),
    listTeams(),
  ]);

  const teamMeta = new Map(teams.map((t) => [t.id, t]));
  const visible = visibleTeamIds(session);
  const canSee = (teamId: string) => visible === null || visible.includes(teamId);
  const canManage = (teamId: string) =>
    session.role === "admin" || session.profile.teams.some((t) => t.id === teamId && t.role === "leader");

  const reqRows = (reqs ?? []) as {
    id: string;
    team_id: string;
    position_id: string;
    needed_count: number;
    status: RequirementStatus;
    note: string | null;
    position: { name: string; sort_order: number } | null;
  }[];
  const assignRows = (assigns ?? []) as {
    id: string;
    team_id: string;
    position_id: string;
    profile_id: string | null;
    status: AssignmentStatus;
    decline_reason: string | null;
    profile: { full_name: string; avatar_url: string | null } | null;
  }[];

  // Agrupa requisitos por equipe (só equipes visíveis).
  const teamIds = Array.from(new Set(reqRows.map((r) => r.team_id))).filter(canSee);

  const detailTeams: DetailTeam[] = teamIds
    .map((teamId) => {
      const meta = teamMeta.get(teamId);
      if (!meta) return null;
      const canMng = canManage(teamId);
      const teamReqs = reqRows
        .filter((r) => r.team_id === teamId)
        .sort((a, b) => (a.position?.sort_order ?? 0) - (b.position?.sort_order ?? 0));

      let needed = 0;
      let assigned = 0;
      let confirmed = 0;

      const positions: DetailPosition[] = teamReqs.map((req) => {
        const posAssigns = assignRows.filter(
          (a) => a.position_id === req.position_id && a.profile_id,
        );
        const filled: SlotPerson[] = posAssigns.map((a) => ({
          assignmentId: a.id,
          profileId: a.profile_id,
          name: a.profile?.full_name || "Alguém",
          avatarUrl: a.profile?.avatar_url ?? null,
          status: a.status,
          declineReason: a.decline_reason,
          isMe: a.profile_id === session.userId,
        }));
        const occ = posAssigns.filter((a) => occupies(a.status)).length;
        if (req.status === "needed") {
          needed += req.needed_count;
          assigned += Math.min(occ, req.needed_count);
          confirmed += Math.min(
            posAssigns.filter((a) => CONFIRMED.includes(a.status)).length,
            req.needed_count,
          );
        }
        const openCount = req.status === "needed" ? Math.max(req.needed_count - occ, 0) : 0;
        return {
          requirementId: req.id,
          positionId: req.position_id,
          positionName: req.position?.name || "Posição",
          needed: req.needed_count,
          status: req.status,
          note: req.note,
          filled,
          openCount,
        };
      });

      // Voluntário vê só o que importa (posições com vaga ou já com gente).
      // O líder/admin vê todas — inclusive as zeradas — pra montar a escala.
      const visiblePositions = canMng
        ? positions
        : positions.filter((p) => (p.status === "needed" && p.needed > 0) || p.filled.length > 0);

      if (!canMng && visiblePositions.length === 0) return null;

      return {
        teamId,
        name: meta.name,
        color: meta.color,
        icon: meta.icon,
        canManage: canMng,
        needed,
        assigned,
        confirmed,
        tone: coverageTone(needed, assigned),
        positions: visiblePositions,
      } satisfies DetailTeam;
    })
    .filter((t): t is DetailTeam => t !== null)
    .sort((a, b) => (teamMeta.get(a.teamId)?.sort_order ?? 0) - (teamMeta.get(b.teamId)?.sort_order ?? 0));

  const responsible = (ev as { responsible?: { full_name: string } | null }).responsible;

  return {
    id: ev.id,
    title: ev.title,
    starts_at: ev.starts_at,
    ends_at: ev.ends_at,
    location: ev.location,
    notes: ev.notes,
    seriesId: ev.series_id,
    responsibleId: ev.responsible_id,
    responsibleName: responsible?.full_name ?? null,
    confirmedAt: ev.confirmed_at,
    teams: detailTeams,
  };
}

// =============================================================================
// APTOS PARA UMA POSIÇÃO (fluxo escalar do líder)
// =============================================================================
export type EligibleMember = {
  profileId: string;
  name: string;
  avatarUrl: string | null;
  knowsPosition: boolean;
  alreadyInEvent: boolean;
};

export async function getEligibleMembers(
  eventId: string,
  teamId: string,
  positionId: string,
): Promise<EligibleMember[]> {
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("memberships")
    .select(
      "id, profile:profiles ( id, full_name, avatar_url, status ), member_positions ( position_id )",
    )
    .eq("team_id", teamId);

  const { data: eventAssigns } = await supabase
    .from("assignments")
    .select("profile_id")
    .eq("event_id", eventId);
  const assignedIds = new Set((eventAssigns ?? []).map((a) => a.profile_id).filter(Boolean));

  const rows = (members ?? []) as {
    id: string;
    profile: { id: string; full_name: string; avatar_url: string | null; status: string } | null;
    member_positions: { position_id: string }[];
  }[];

  return rows
    .filter((m) => m.profile && m.profile.status === "ativo")
    .map((m) => ({
      profileId: m.profile!.id,
      name: m.profile!.full_name || "Sem nome",
      avatarUrl: m.profile!.avatar_url,
      knowsPosition: m.member_positions.some((mp) => mp.position_id === positionId),
      alreadyInEvent: assignedIds.has(m.profile!.id),
    }))
    .sort((a, b) => {
      if (a.knowsPosition !== b.knowsPosition) return a.knowsPosition ? -1 : 1;
      return a.name.localeCompare(b.name, "pt-BR");
    });
}

// =============================================================================
// HOME — VOLUNTÁRIO
// =============================================================================
export type MyAssignment = {
  assignmentId: string;
  status: AssignmentStatus;
  declineReason: string | null;
  eventId: string;
  eventTitle: string;
  startsAt: string;
  location: string | null;
  positionName: string;
  teamName: string;
  teamColor: string;
};

export async function getMyUpcomingAssignments(session: Session): Promise<MyAssignment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("assignments")
    .select(
      `id, status, decline_reason,
       events!inner ( id, title, starts_at, location ),
       positions ( name ),
       teams ( name, color )`,
    )
    .eq("profile_id", session.userId)
    .limit(100);

  const cutoff = upcomingCutoffIso();
  const rows = (data ?? []) as {
    id: string;
    status: AssignmentStatus;
    decline_reason: string | null;
    events: { id: string; title: string; starts_at: string; location: string | null } | null;
    positions: { name: string } | null;
    teams: { name: string; color: string } | null;
  }[];

  return rows
    .filter((r) => r.events && r.events.starts_at >= cutoff && r.status !== "recusado")
    .map((r) => ({
      assignmentId: r.id,
      status: r.status,
      declineReason: r.decline_reason,
      eventId: r.events!.id,
      eventTitle: r.events!.title,
      startsAt: r.events!.starts_at,
      location: r.events!.location,
      positionName: r.positions?.name || "Posição",
      teamName: r.teams?.name || "Equipe",
      teamColor: r.teams?.color || "#C4633E",
    }))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

// =============================================================================
// HOME — LÍDER
// =============================================================================
export type LeaderHome = {
  events: EventListItem[]; // já filtrados pras equipes que ele lidera
  openVacancies: number;
  awaitingConfirmation: number;
  interests: {
    id: string;
    personName: string;
    teamName: string;
    positionName: string | null;
    note: string | null;
  }[];
};

export async function getLeaderHome(session: Session): Promise<LeaderHome> {
  const supabase = await createClient();
  const leadIds = session.profile.teams.filter((t) => t.role === "leader").map((t) => t.id);

  const events = await listUpcomingEvents(session, 20);
  // Restringe as badges às equipes lideradas.
  const leaderEvents = events
    .map((ev) => ({ ...ev, teams: ev.teams.filter((t) => leadIds.includes(t.teamId)) }))
    .filter((ev) => ev.teams.length > 0);

  let openVacancies = 0;
  for (const ev of leaderEvents) {
    for (const t of ev.teams) openVacancies += Math.max(t.needed - t.assigned, 0);
  }

  // Aguardando confirmação: assignments 'convidado' nas equipes lideradas em eventos futuros.
  let awaitingConfirmation = 0;
  if (leadIds.length > 0 && leaderEvents.length > 0) {
    const { data: pending } = await supabase
      .from("assignments")
      .select("id, status, team_id, event_id, events!inner ( starts_at )")
      .in("team_id", leadIds)
      .eq("status", "convidado")
      .gte("events.starts_at", upcomingCutoffIso());
    awaitingConfirmation = (pending ?? []).length;
  }

  let interests: LeaderHome["interests"] = [];
  if (leadIds.length > 0) {
    const { data } = await supabase
      .from("service_interests")
      .select(
        "id, note, status, profile:profiles ( full_name ), team:teams ( name ), position:positions ( name )",
      )
      .in("team_id", leadIds)
      .eq("status", "aberto")
      .limit(10);
    interests = ((data ?? []) as {
      id: string;
      note: string | null;
      profile: { full_name: string } | null;
      team: { name: string } | null;
      position: { name: string } | null;
    }[]).map((i) => ({
      id: i.id,
      personName: i.profile?.full_name || "Alguém",
      teamName: i.team?.name || "Equipe",
      positionName: i.position?.name ?? null,
      note: i.note,
    }));
  }

  return { events: leaderEvents, openVacancies, awaitingConfirmation, interests };
}

// =============================================================================
// HOME — ADMIN
// =============================================================================
export type AdminHome = {
  pendingJoinRequests: number;
  pendingInvites: number;
  upcomingCount: number;
  coverageHoles: { eventId: string; title: string; startsAt: string; missing: number }[];
  awaitingResponsible: { eventId: string; title: string; startsAt: string; responsibleName: string | null }[];
  nextEvent: EventListItem | null;
};

export async function getAdminHome(session: Session): Promise<AdminHome> {
  const supabase = await createClient();
  const events = await listUpcomingEvents(session, 30);

  const coverageHoles = events
    .map((ev) => ({
      eventId: ev.id,
      title: ev.title,
      startsAt: ev.starts_at,
      missing: Math.max(ev.neededTotal - ev.assignedTotal, 0),
    }))
    .filter((e) => e.missing > 0)
    .slice(0, 6);

  const [{ count: joinCount }, { count: inviteCount }, { data: awaitingRows }] = await Promise.all([
    supabase.from("join_requests").select("id", { count: "exact", head: true }).eq("status", "pendente"),
    supabase.from("invites").select("id", { count: "exact", head: true }).eq("status", "pendente"),
    supabase
      .from("events")
      .select("id, title, starts_at, responsible:profiles!events_responsible_id_fkey ( full_name )")
      .not("responsible_id", "is", null)
      .is("confirmed_at", null)
      .gte("starts_at", upcomingCutoffIso())
      .order("starts_at")
      .limit(6),
  ]);

  const awaitingResponsible = ((awaitingRows ?? []) as {
    id: string;
    title: string;
    starts_at: string;
    responsible: { full_name: string } | null;
  }[]).map((e) => ({
    eventId: e.id,
    title: e.title,
    startsAt: e.starts_at,
    responsibleName: e.responsible?.full_name ?? null,
  }));

  return {
    pendingJoinRequests: joinCount ?? 0,
    pendingInvites: inviteCount ?? 0,
    upcomingCount: events.length,
    coverageHoles,
    awaitingResponsible,
    nextEvent: events[0] ?? null,
  };
}

// =============================================================================
// PESSOAS / ONBOARDING (admin)
// =============================================================================
export type MemberRow = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  systemRole: string;
  status: string;
  teams: { name: string; color: string; role: string }[];
};

export async function listMembers(): Promise<MemberRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, phone, avatar_url, system_role, status, memberships ( role, team:teams ( name, color ) )",
    )
    .order("full_name");
  return ((data ?? []) as {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    avatar_url: string | null;
    system_role: string;
    status: string;
    memberships: { role: string; team: { name: string; color: string } | null }[];
  }[]).map((p) => ({
    id: p.id,
    fullName: p.full_name || "Sem nome",
    email: p.email,
    phone: p.phone,
    avatarUrl: p.avatar_url,
    systemRole: p.system_role,
    status: p.status,
    teams: (p.memberships ?? [])
      .filter((m) => m.team)
      .map((m) => ({ name: m.team!.name, color: m.team!.color, role: m.role })),
  }));
}

export type PendingJoin = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  message: string | null;
  createdAt: string;
};

export async function listPendingJoinRequests(): Promise<PendingJoin[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("join_requests")
    .select("id, full_name, email, phone, message, created_at")
    .eq("status", "pendente")
    .order("created_at", { ascending: false });
  return ((data ?? []) as {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    message: string | null;
    created_at: string;
  }[]).map((j) => ({
    id: j.id,
    fullName: j.full_name,
    email: j.email,
    phone: j.phone,
    message: j.message,
    createdAt: j.created_at,
  }));
}

export type InviteRow = {
  id: string;
  email: string;
  fullName: string;
  systemRole: string;
  status: string;
  createdAt: string;
  teams: { name: string; color: string; role: string }[];
};

export async function listInvites(): Promise<InviteRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invites")
    .select(
      "id, email, full_name, system_role, status, created_at, invite_teams ( role, team:teams ( name, color ) )",
    )
    .order("created_at", { ascending: false });
  return ((data ?? []) as {
    id: string;
    email: string;
    full_name: string;
    system_role: string;
    status: string;
    created_at: string;
    invite_teams: { role: string; team: { name: string; color: string } | null }[];
  }[]).map((i) => ({
    id: i.id,
    email: i.email,
    fullName: i.full_name,
    systemRole: i.system_role,
    status: i.status,
    createdAt: i.created_at,
    teams: (i.invite_teams ?? [])
      .filter((t) => t.team)
      .map((t) => ({ name: t.team!.name, color: t.team!.color, role: t.role })),
  }));
}

/** Aniversariantes do mês (igreja toda). */
export async function getBirthdaysThisMonth(): Promise<{ name: string; birthDate: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("full_name, birth_date")
    .not("birth_date", "is", null)
    .eq("status", "ativo");
  const month = new Date().getMonth() + 1;
  return ((data ?? []) as { full_name: string; birth_date: string }[])
    .filter((p) => Number(p.birth_date.split("-")[1]) === month)
    .map((p) => ({ name: p.full_name, birthDate: p.birth_date }))
    .sort((a, b) => Number(a.birthDate.split("-")[2]) - Number(b.birthDate.split("-")[2]));
}
