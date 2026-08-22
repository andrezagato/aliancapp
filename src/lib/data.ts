import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  coverageByTeam,
  confirmTone,
  occupies,
  CONFIRMED,
  type CoverageTone,
  type ReqRow,
  type AssignRow,
} from "@/lib/coverage";
import { BADGES, earnedCodes, type JourneyMetrics } from "@/lib/achievements";
import { CATEGORY_PALETTE } from "@/lib/palette";
import {
  NOTIFICATION_TOPICS,
  defaultTopicPrefs,
  type TopicPrefs,
} from "@/lib/notification-topics";
import {
  type Session,
  memberTeamIds,
  leadTeamIds,
} from "@/lib/auth";
import { churchDateISO } from "@/lib/format";
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

/**
 * Equipes que o usuário enxerga DENTRO da escala de um culto — regra própria,
 * mais larga que a de cima. Líder abre um culto e vê o culto INTEIRO: todas as
 * equipes, quem está escalado, em que posição, se confirmou. Só ver: quem MEXE
 * continua sendo `canManage` (admin ou líder daquela equipe), que não mudou.
 *
 * NÃO é `visibleTeamIds`, de propósito. Aquela alimenta `assembleEventList` —
 * home e calendário —, que continuam mostrando só as equipes do líder. Ver o
 * culto inteiro vale quando ele ABRE o culto, não no relance da home.
 */
function eventVisibleTeamIds(session: Session): string[] | null {
  if (session.role === "admin" || session.role === "leader") return null;
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
  whatsapp_group: string | null;
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
    .select("id, name, color, icon, sort_order, whatsapp_group")
    .is("archived_at", null)
    .order("sort_order");
  return data ?? [];
}

/** O usuário logado está escalado (tem assignment) neste evento? */
export async function estouEscaladoNoEvento(session: Session, eventId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("assignments")
    .select("id")
    .eq("event_id", eventId)
    .eq("profile_id", session.userId)
    .limit(1)
    .maybeSingle();
  return !!data;
}

/** Link da pasta de arquivos (OneDrive) do evento — mostrado no cronograma. */
export async function getPastaEvento(eventId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("files_url").eq("id", eventId).maybeSingle();
  return data?.files_url ?? null;
}

export type TeamWithPositions = TeamMeta & { positions: PositionMeta[]; leaders: string[] };

export async function listTeamsWithPositions(): Promise<TeamWithPositions[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("teams")
    .select(
      "id, name, color, icon, sort_order, whatsapp_group, positions ( id, team_id, name, sort_order, archived_at ), memberships ( role, profile:profiles ( full_name ) )",
    )
    .is("archived_at", null)
    .order("sort_order");
  return (data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    icon: t.icon,
    sort_order: t.sort_order,
    whatsapp_group: t.whatsapp_group,
    positions: ((t.positions ?? []) as (PositionMeta & { archived_at: string | null })[])
      .filter((p) => !p.archived_at)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((p) => ({ id: p.id, team_id: p.team_id, name: p.name, sort_order: p.sort_order })),
    leaders: ((t.memberships ?? []) as { role: string; profile: { full_name: string | null } | null }[])
      .filter((m) => m.role === "leader" && m.profile?.full_name)
      .map((m) => m.profile!.full_name as string),
  }));
}

export type TeamMember = {
  membershipId: string;
  profileId: string;
  name: string;
  avatarUrl: string | null;
  role: "leader" | "volunteer";
};

export type ManageableTeam = TeamWithPositions & { members: TeamMember[] };

/** Equipes que o usuário pode gerenciar (admin: todas; líder: as que lidera) + membros. */
export async function getManageableTeams(session: Session): Promise<ManageableTeam[]> {
  const withPos = await listTeamsWithPositions();
  const manageable =
    session.role === "admin"
      ? withPos
      : (() => {
          const lead = new Set(
            session.profile.teams.filter((t) => t.role === "leader").map((t) => t.id),
          );
          return withPos.filter((t) => lead.has(t.id));
        })();

  const teamIds = manageable.map((t) => t.id);
  if (teamIds.length === 0) return manageable.map((t) => ({ ...t, members: [] }));

  const supabase = await createClient();
  const { data } = await supabase
    .from("memberships")
    .select("id, team_id, role, profile:profiles ( id, full_name, avatar_url, status )")
    .in("team_id", teamIds);

  const rows = (data ?? []) as {
    id: string;
    team_id: string;
    role: "leader" | "volunteer";
    profile: { id: string; full_name: string; avatar_url: string | null; status: string } | null;
  }[];

  return manageable.map((t) => ({
    ...t,
    members: rows
      .filter((m) => m.team_id === t.id && m.profile)
      .map((m) => ({
        membershipId: m.id,
        profileId: m.profile!.id,
        name: m.profile!.full_name || "Sem nome",
        avatarUrl: m.profile!.avatar_url,
        role: m.role,
      }))
      .sort((a, b) => {
        if (a.role !== b.role) return a.role === "leader" ? -1 : 1;
        return a.name.localeCompare(b.name, "pt-BR");
      }),
  }));
}

// =============================================================================
// MODELOS DE EVENTO (event_series + series_teams)
// =============================================================================
export type EventTemplate = {
  id: string;
  title: string;
  startTime: string; // HH:mm:ss
  callTime: string | null; // HH:mm:ss — chegada da equipe (opcional)
  location: string | null;
  teams: { id: string; name: string; color: string }[];
};

export async function listTemplates(): Promise<EventTemplate[]> {
  const supabase = await createClient();
  const [{ data: series }, { data: links }, teams] = await Promise.all([
    supabase.from("event_series").select("id, title, start_time, call_time, location").order("title"),
    supabase.from("series_teams").select("series_id, team_id"),
    listTeams(),
  ]);
  const teamMeta = new Map(teams.map((t) => [t.id, t]));
  const linkRows = (links ?? []) as { series_id: string; team_id: string }[];

  return ((series ?? []) as {
    id: string;
    title: string;
    start_time: string;
    call_time: string | null;
    location: string | null;
  }[]).map(
    (s) => ({
      id: s.id,
      title: s.title,
      startTime: s.start_time,
      callTime: s.call_time,
      location: s.location,
      teams: linkRows
        .filter((l) => l.series_id === s.id)
        .map((l) => teamMeta.get(l.team_id))
        .filter((t): t is TeamMeta => !!t)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((t) => ({ id: t.id, name: t.name, color: t.color })),
    }),
  );
}

/** Pessoas ativas da igreja (para o seletor de "adicionar membro"). */
export async function listChurchProfiles(): Promise<{ id: string; name: string; avatarUrl: string | null }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .eq("status", "ativo")
    .order("full_name");
  return ((data ?? []) as { id: string; full_name: string; avatar_url: string | null }[]).map((p) => ({
    id: p.id,
    name: p.full_name || "Sem nome",
    avatarUrl: p.avatar_url,
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
  responsibleId: string | null;
  responsibleName: string | null;
  teams: EventTeamCoverage[];
  overallTone: CoverageTone;
  neededTotal: number;
  assignedTotal: number;
  confirmedTotal: number;
};

type EventRowLite = {
  id: string;
  title: string;
  starts_at: string;
  location: string | null;
  series_id: string | null;
  responsible_id?: string | null;
  responsible?: { full_name: string } | null;
};

async function assembleEventList(session: Session, events: EventRowLite[]): Promise<EventListItem[]> {
  if (events.length === 0) return [];
  const supabase = await createClient();
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
    let confirmedTotal = 0;
    for (const [teamId, cov] of perTeam) {
      if (!canSee(teamId)) continue;
      const meta = teamMeta.get(teamId);
      if (!meta) continue;
      neededTotal += cov.needed;
      assignedTotal += cov.assigned;
      confirmedTotal += cov.confirmed;
      teamCov.push({
        teamId,
        name: meta.name,
        color: meta.color,
        needed: cov.needed,
        assigned: cov.assigned,
        confirmed: cov.confirmed,
        tone: confirmTone(cov.needed, cov.confirmed, cov.assigned),
      });
    }
    teamCov.sort((a, b) => (teamMeta.get(a.teamId)?.sort_order ?? 0) - (teamMeta.get(b.teamId)?.sort_order ?? 0));

    return {
      id: ev.id,
      title: ev.title,
      starts_at: ev.starts_at,
      location: ev.location,
      seriesId: ev.series_id,
      responsibleId: ev.responsible_id ?? null,
      responsibleName: ev.responsible?.full_name ?? null,
      teams: teamCov,
      overallTone: confirmTone(neededTotal, confirmedTotal, assignedTotal),
      neededTotal,
      assignedTotal,
      confirmedTotal,
    };
  });
}

export async function listUpcomingEvents(session: Session, limit = 50): Promise<EventListItem[]> {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("id, title, starts_at, location, series_id, responsible_id, responsible:profiles!events_responsible_id_fkey ( full_name )")
    .is("archived_at", null)
    .gte("starts_at", upcomingCutoffIso())
    .order("starts_at", { ascending: true })
    .limit(limit);
  return assembleEventList(session, (events ?? []) as EventRowLite[]);
}

/**
 * Cultos com roteiro ABERTO (iniciado e ainda não encerrado) que já saíram da
 * janela de "próximos" — o culto começou, o líder esqueceu de encerrar e ele
 * sumiria do Roteiro. Traz de volta pra ele poder encerrar (e liberar a
 * avaliação da equipe).
 */
export async function listLiveRundownEvents(session: Session): Promise<EventListItem[]> {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("id, title, starts_at, location, series_id, responsible_id, responsible:profiles!events_responsible_id_fkey ( full_name )")
    .is("archived_at", null)
    .not("rundown_started_at", "is", null)
    .is("rundown_ended_at", null)
    .lt("starts_at", upcomingCutoffIso())
    .order("starts_at", { ascending: true });
  return assembleEventList(session, (events ?? []) as EventRowLite[]);
}

/**
 * O culto que está acontecendo AGORA (roteiro iniciado e não encerrado), pro
 * card da Home. Diferente de `listLiveRundownEvents`, que só pega o que já saiu
 * da janela de "próximos" — aqui o que importa é estar rolando, mesmo que tenha
 * começado há 5 minutos.
 */
export async function getCultoAoVivo(
  session: Session,
): Promise<{ eventId: string; title: string; startedAt: string } | null> {
  if (!session.profile.church_id) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("id, title, rundown_started_at")
    .eq("church_id", session.profile.church_id)
    .is("archived_at", null)
    .not("rundown_started_at", "is", null)
    .is("rundown_ended_at", null)
    .order("rundown_started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.rundown_started_at) return null;
  return { eventId: data.id, title: data.title || "Culto", startedAt: data.rundown_started_at };
}

/** Cultos JÁ ENCERRADos (roteiro encerrado) dos últimos 60 dias — pra seção
 * "Finalizados" da aba Escalas (histórico recente + avaliação da equipe). */
export async function listEndedEvents(session: Session, limit = 20): Promise<EventListItem[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const { data: events } = await supabase
    .from("events")
    .select("id, title, starts_at, location, series_id, responsible_id, responsible:profiles!events_responsible_id_fkey ( full_name )")
    .is("archived_at", null)
    .not("rundown_ended_at", "is", null)
    .gte("starts_at", since)
    .order("starts_at", { ascending: false })
    .limit(limit);
  return assembleEventList(session, (events ?? []) as EventRowLite[]);
}

export async function listEventsInRange(
  session: Session,
  fromIso: string,
  toIso: string,
): Promise<EventListItem[]> {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("id, title, starts_at, location, series_id, responsible_id, responsible:profiles!events_responsible_id_fkey ( full_name )")
    .is("archived_at", null)
    .gte("starts_at", fromIso)
    .lt("starts_at", toIso)
    .order("starts_at", { ascending: true });
  return assembleEventList(session, (events ?? []) as EventRowLite[]);
}

// =============================================================================
// PEDIDOS DE EVENTO (líder sugere -> admin aprova)
// =============================================================================
export type PendingEventRequest = {
  id: string;
  title: string;
  desiredAt: string | null;
  location: string | null;
  note: string | null;
  requesterName: string;
};

/** Pedidos de evento aguardando decisão (visível só ao admin, via RLS). */
export async function listPendingEventRequests(): Promise<PendingEventRequest[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("event_requests")
    .select(
      "id, title, desired_at, location, note, requester:profiles!event_requests_requested_by_fkey ( full_name )",
    )
    .eq("status", "pendente")
    .order("created_at", { ascending: true });
  return ((data ?? []) as {
    id: string;
    title: string;
    desired_at: string | null;
    location: string | null;
    note: string | null;
    requester: { full_name: string } | null;
  }[]).map((r) => ({
    id: r.id,
    title: r.title,
    desiredAt: r.desired_at,
    location: r.location,
    note: r.note,
    requesterName: r.requester?.full_name || "Alguém",
  }));
}

export type MyEventRequest = {
  id: string;
  title: string;
  desiredAt: string | null;
  status: "pendente" | "aprovado" | "recusado";
};

/** Pedidos de evento que EU fiz (pra acompanhar o status na home). */
export async function getMyEventRequests(session: Session): Promise<MyEventRequest[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("event_requests")
    .select("id, title, desired_at, status")
    .eq("requested_by", session.userId)
    .order("created_at", { ascending: false })
    .limit(10);
  return ((data ?? []) as {
    id: string;
    title: string;
    desired_at: string | null;
    status: "pendente" | "aprovado" | "recusado";
  }[]).map((r) => ({ id: r.id, title: r.title, desiredAt: r.desired_at, status: r.status }));
}

export type ResolvedInterest = {
  id: string;
  personName: string;
  teamName: string;
  status: "atendido" | "arquivado";
  resolvedNote: string | null;
  resolvedAt: string | null;
};

/** Histórico de pedidos de servir já resolvidos das equipes que eu gerencio. */
export async function getResolvedInterests(session: Session): Promise<ResolvedInterest[]> {
  const supabase = await createClient();
  let q = supabase
    .from("service_interests")
    .select(
      "id, status, resolved_note, resolved_at, team_id, profile:profiles!service_interests_profile_id_fkey ( full_name ), team:teams ( name )",
    )
    .neq("status", "aberto");
  if (session.role !== "admin") {
    const leadIds = session.profile.teams.filter((t) => t.role === "leader").map((t) => t.id);
    if (leadIds.length === 0) return [];
    q = q.in("team_id", leadIds);
  }
  const { data } = await q.order("resolved_at", { ascending: false, nullsFirst: false }).limit(30);
  return ((data ?? []) as {
    id: string;
    status: "atendido" | "arquivado";
    resolved_note: string | null;
    resolved_at: string | null;
    profile: { full_name: string } | null;
    team: { name: string } | null;
  }[]).map((i) => ({
    id: i.id,
    personName: i.profile?.full_name || "Alguém",
    teamName: i.team?.name || "Equipe",
    status: i.status,
    resolvedNote: i.resolved_note,
    resolvedAt: i.resolved_at,
  }));
}

// =============================================================================
// MINHA JORNADA (conquistas do voluntário)
// =============================================================================
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

async function computeJourneyMetrics(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  active: boolean,
  isLeader: boolean,
  perfilCompleto: boolean,
): Promise<JourneyMetrics> {
  const nowIso = new Date().toISOString();

  const { data: aRows } = await supabase
    .from("assignments")
    .select("id, status, team_id, created_at, responded_at, events!inner ( starts_at, call_time )")
    .eq("profile_id", userId);
  const rows = (aRows ?? []) as {
    id: string;
    status: AssignmentStatus;
    team_id: string;
    created_at: string;
    responded_at: string | null;
    events: { starts_at: string; call_time: string | null } | null;
  }[];

  const past = rows
    .filter((r) => r.events && r.events.starts_at < nowIso)
    .sort((a, b) => (a.events!.starts_at < b.events!.starts_at ? -1 : 1));
  const isServed = (s: AssignmentStatus) => s === "confirmado" || s === "presente";

  const servedRows = past.filter((r) => isServed(r.status));
  const servido = servedRows.length;
  const ministerios = new Set(servedRows.map((r) => r.team_id)).size;

  // Sequência: cultos passados seguidos servidos (zera ao recusar).
  let streak = 0;
  for (const r of past) streak = isServed(r.status) ? streak + 1 : 0;

  // Confirmações rápidas (confirmou em < 6h de ser escalado).
  const rapida = rows.filter(
    (r) =>
      r.status === "confirmado" &&
      r.responded_at &&
      new Date(r.responded_at).getTime() - new Date(r.created_at).getTime() < SIX_HOURS_MS,
  ).length;

  // Meses de VOLUNTARIADO (desde o 1º culto servido).
  let meses = 0;
  if (servedRows.length > 0) {
    const first = new Date(servedRows[0].events!.starts_at).getTime();
    meses = Math.max(0, Math.floor((Date.now() - first) / (30 * 24 * 60 * 60 * 1000)));
  }

  // Check-ins + pontualidade (chegou até 10min depois do call time — ou do início, se não houver call).
  let checkin = 0;
  let pontual = 0;
  let noLocal = 0;
  const refById = new Map(rows.filter((r) => r.events).map((r) => [r.id, r.events!.call_time ?? r.events!.starts_at]));
  const ids = rows.map((r) => r.id);
  if (ids.length > 0) {
    const { data: c } = await supabase
      .from("checkins")
      .select("assignment_id, checked_at, at_location")
      .in("assignment_id", ids);
    const cks = (c ?? []) as { assignment_id: string; checked_at: string; at_location: boolean | null }[];
    checkin = cks.length;
    noLocal = cks.filter((ck) => ck.at_location === true).length;
    const GRACE = 10 * 60 * 1000;
    pontual = cks.filter((ck) => {
      const s = refById.get(ck.assignment_id);
      return s ? new Date(ck.checked_at).getTime() <= new Date(s).getTime() + GRACE : false;
    }).length;
  }

  // "Primeiro no local": nº de eventos em que fui o 1º a fazer check-in no local.
  // Via RPC SECURITY DEFINER — a RLS de checkins não deixa enxergar outras equipes.
  let primeiroLocal = 0;
  {
    const { data: pnl } = await supabase.rpc("primeiro_no_local_count");
    if (typeof pnl === "number") primeiroLocal = pnl;
  }

  // Feedbacks dados (cada culto avaliado).
  const { data: fb } = await supabase.from("event_feedback").select("id").eq("profile_id", userId);
  const feedbacks = (fb ?? []).length;

  // "Salvou o culto": aceitou ser substituto numa troca.
  const { data: subs } = await supabase
    .from("swap_requests")
    .select("id")
    .eq("suggested_profile_id", userId)
    .not("substitute_accepted_at", "is", null);
  const salvou = (subs ?? []).length;

  // Explorador: sinalizou interesse em servir em alguma equipe.
  const { data: ints } = await supabase.from("service_interests").select("id").eq("profile_id", userId);
  const interesses = (ints ?? []).length;

  // Maratona: máximo de cultos servidos num mesmo mês.
  const perMonth = new Map<string, number>();
  for (const r of servedRows) {
    const mk = churchDateISO(r.events!.starts_at).slice(0, 7);
    perMonth.set(mk, (perMonth.get(mk) ?? 0) + 1);
  }
  const maratona = perMonth.size > 0 ? Math.max(...perMonth.values()) : 0;

  return {
    cadastro: active ? 1 : 0,
    escalado: rows.length,
    servido,
    checkin,
    streak,
    ministerios,
    salvou,
    rapida,
    meses,
    lider: isLeader ? 1 : 0,
    interesses,
    maratona,
    pontual,
    feedbacks,
    no_local: noLocal,
    primeiro_local: primeiroLocal,
    perfil: perfilCompleto ? 1 : 0,
  };
}

export type JourneyBadge = {
  code: string;
  emoji: string;
  title: string;
  desc: string;
  unlocked: boolean;
  unlockedAt: string | null;
  current: number;
  target: number;
};

export type Journey = {
  metrics: JourneyMetrics;
  badges: JourneyBadge[];
  unlockedCount: number;
};

/**
 * Garante que as conquistas merecidas estão gravadas (com o próprio login, sob
 * RLS) e devolve os códigos recém-inseridos. Idempotente.
 */
export async function syncAchievements(
  session: Session,
): Promise<{ metrics: JourneyMetrics; newly: string[]; earned: string[] }> {
  const supabase = await createClient();
  const active = session.profile.status === "ativo";
  const isLeader = session.profile.teams.some((t) => t.role === "leader");
  // mesmos 3 campos que o card "Complete seu perfil" cobra na home
  const p = session.profile;
  const perfilCompleto = !!(p.avatar_url && p.phone && p.birth_date);
  const metrics = await computeJourneyMetrics(supabase, session.userId, active, isLeader, perfilCompleto);
  const earned = earnedCodes(metrics);

  const { data: existingRows } = await supabase
    .from("achievements")
    .select("code")
    .eq("profile_id", session.userId);
  const existing = new Set((existingRows ?? []).map((r) => r.code));
  const missing = earned.filter((c) => !existing.has(c));
  if (missing.length > 0) {
    await supabase
      .from("achievements")
      .upsert(
        missing.map((code) => ({ profile_id: session.userId, code })),
        { onConflict: "profile_id,code", ignoreDuplicates: true },
      );
  }
  return { metrics, newly: missing, earned };
}

// =============================================================================
// PREFERÊNCIAS DE AVISO (por assunto — ver notification-topics.ts)
// =============================================================================

/**
 * Preferências da PRÓPRIA pessoa, já traduzidas de tipo pra assunto. Linha
 * ausente = ligado (é o default do banco). Um assunto só aparece desligado
 * quando TODOS os tipos dele estão desligados — que é exatamente o que o
 * interruptor escreve.
 */
export async function getMyNotificationPrefs(session: Session): Promise<TopicPrefs> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notification_prefs")
    .select("kind, push, email")
    .eq("profile_id", session.userId);
  const byKind = new Map((data ?? []).map((r) => [r.kind as string, r]));
  const out = defaultTopicPrefs();
  for (const t of NOTIFICATION_TOPICS) {
    out[t.id] = {
      push: t.kinds.some((k) => byKind.get(k)?.push !== false),
      email: t.kinds.some((k) => byKind.get(k)?.email !== false),
    };
  }
  return out;
}

export async function getMyJourney(session: Session): Promise<Journey> {
  const { metrics } = await syncAchievements(session);
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("achievements")
    .select("code, unlocked_at")
    .eq("profile_id", session.userId);
  const unlockedAt = new Map((rows ?? []).map((r) => [r.code as string, r.unlocked_at as string]));

  const badges: JourneyBadge[] = BADGES.map((b) => ({
    code: b.code,
    emoji: b.emoji,
    title: b.title,
    desc: b.desc,
    unlocked: unlockedAt.has(b.code),
    unlockedAt: unlockedAt.get(b.code) ?? null,
    current: metrics[b.metric] ?? 0,
    target: b.target,
  }));
  badges.sort((a, b) => {
    if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
    if (a.unlocked && b.unlocked) return (b.unlockedAt ?? "").localeCompare(a.unlockedAt ?? "");
    return b.current / b.target - a.current / a.target;
  });

  return { metrics, badges, unlockedCount: badges.filter((x) => x.unlocked).length };
}

// =============================================================================
// FEEDBACK DO CULTO (privado — só a própria pessoa vê)
// =============================================================================
export type PendingFeedback = { eventId: string; title: string; startsAt: string };

/** Cultos recentes (14 dias) que a pessoa serviu e ainda não avaliou. */
export async function getPendingFeedback(session: Session): Promise<PendingFeedback[]> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("assignments")
    .select("event_id, status, events!inner ( title, starts_at )")
    .eq("profile_id", session.userId)
    .in("status", ["confirmado", "presente"])
    .gte("events.starts_at", since)
    .lt("events.starts_at", nowIso);
  const rows = (data ?? []) as { event_id: string; events: { title: string; starts_at: string } | null }[];
  const byEvent = new Map<string, { title: string; startsAt: string }>();
  for (const r of rows) {
    if (r.events && !byEvent.has(r.event_id)) byEvent.set(r.event_id, { title: r.events.title, startsAt: r.events.starts_at });
  }
  if (byEvent.size === 0) return [];
  const { data: fb } = await supabase
    .from("event_feedback")
    .select("event_id")
    .eq("profile_id", session.userId)
    .in("event_id", [...byEvent.keys()]);
  const done = new Set((fb ?? []).map((f) => f.event_id));
  return [...byEvent.entries()]
    .filter(([id]) => !done.has(id))
    .map(([eventId, v]) => ({ eventId, title: v.title, startsAt: v.startsAt }))
    .sort((a, b) => (a.startsAt < b.startsAt ? 1 : -1));
}

// =============================================================================
// AVALIAÇÃO DA EQUIPE (o LÍDER avalia o culto + observa cada pessoa) — privado
// =============================================================================
export type PendingTeamReview = { eventId: string; title: string; startsAt: string };

/** Cultos encerrados (14d) com gente da equipe do líder que ele ainda não avaliou.
 * Admin: todos os cultos encerrados recentes ainda sem a nota dele. */
export async function getPendingTeamReviews(session: Session): Promise<PendingTeamReview[]> {
  const isAdmin = session.role === "admin";
  const leadIds = session.profile.teams.filter((t) => t.role === "leader").map((t) => t.id);
  if (!isAdmin && leadIds.length === 0) return [];
  const supabase = await createClient();
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  let q = supabase
    .from("assignments")
    .select("event_id, team_id, status, events!inner ( title, starts_at, rundown_ended_at, archived_at )")
    .in("status", ["confirmado", "presente"])
    .gte("events.starts_at", since)
    .not("events.rundown_ended_at", "is", null);
  if (!isAdmin) q = q.in("team_id", leadIds);
  const { data } = await q;
  const rows = (data ?? []) as {
    event_id: string;
    events: { title: string; starts_at: string; archived_at: string | null } | null;
  }[];
  const byEvent = new Map<string, { title: string; startsAt: string }>();
  for (const r of rows) {
    if (r.events && !r.events.archived_at && !byEvent.has(r.event_id))
      byEvent.set(r.event_id, { title: r.events.title, startsAt: r.events.starts_at });
  }
  if (byEvent.size === 0) return [];
  const { data: done } = await supabase
    .from("culto_avaliacoes")
    .select("event_id")
    .eq("author_id", session.userId)
    .in("event_id", [...byEvent.keys()]);
  const doneSet = new Set((done ?? []).map((d) => d.event_id));
  return [...byEvent.entries()]
    .filter(([id]) => !doneSet.has(id))
    .map(([eventId, v]) => ({ eventId, title: v.title, startsAt: v.startsAt }))
    .sort((a, b) => (a.startsAt < b.startsAt ? 1 : -1));
}

export type ReviewPerson = { profileId: string; name: string; teamName: string; note: string };
export type EventReviewData = {
  eventId: string;
  title: string;
  startsAt: string;
  myRating: number | null;
  people: ReviewPerson[];
};

/** Dados pro modal de revisão: pessoas que serviram (equipes do líder, ou todas
 * se admin) + a nota e as observações que ESTE autor já gravou. */
export async function getEventReviewData(session: Session, eventId: string): Promise<EventReviewData | null> {
  const isAdmin = session.role === "admin";
  const leadIds = session.profile.teams.filter((t) => t.role === "leader").map((t) => t.id);
  if (!isAdmin && leadIds.length === 0) return null;
  const supabase = await createClient();

  const { data: ev } = await supabase.from("events").select("title, starts_at").eq("id", eventId).maybeSingle();
  if (!ev) return null;

  let aq = supabase
    .from("assignments")
    .select("profile_id, team_id, status, profile:profiles!assignments_profile_id_fkey ( id, full_name, nickname ), team:teams ( name )")
    .eq("event_id", eventId)
    .in("status", ["confirmado", "presente"]);
  if (!isAdmin) aq = aq.in("team_id", leadIds);

  const [{ data: asg }, { data: rating }, { data: obs }] = await Promise.all([
    aq,
    supabase
      .from("culto_avaliacoes")
      .select("rating")
      .eq("event_id", eventId)
      .eq("author_id", session.userId)
      .maybeSingle(),
    supabase.from("pessoa_observacoes").select("subject_id, note").eq("event_id", eventId).eq("author_id", session.userId),
  ]);

  const noteMap = new Map((obs ?? []).map((o) => [o.subject_id, o.note]));
  const seen = new Set<string>();
  const people: ReviewPerson[] = [];
  for (const a of (asg ?? []) as {
    profile_id: string | null;
    profile: { id: string; full_name: string | null; nickname: string | null } | null;
    team: { name: string } | null;
  }[]) {
    const pid = a.profile?.id ?? a.profile_id;
    if (!pid || seen.has(pid)) continue;
    seen.add(pid);
    people.push({
      profileId: pid,
      name: a.profile?.nickname || a.profile?.full_name || "Alguém",
      teamName: a.team?.name ?? "",
      note: noteMap.get(pid) ?? "",
    });
  }
  people.sort((a, b) => a.name.localeCompare(b.name));
  return { eventId, title: ev.title, startsAt: ev.starts_at, myRating: rating?.rating ?? null, people };
}

export type PersonObservation = {
  id: string;
  note: string;
  authorName: string;
  eventTitle: string;
  startsAt: string;
  createdAt: string;
};

/** Observações da liderança SOBRE uma pessoa (lido no modal da pessoa). A RLS só
 * devolve as do próprio autor ou tudo se admin. */
export async function getPersonObservations(subjectId: string): Promise<PersonObservation[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pessoa_observacoes")
    .select(
      "id, note, created_at, author:profiles!pessoa_observacoes_author_id_fkey ( full_name, nickname ), event:events ( title, starts_at )",
    )
    .eq("subject_id", subjectId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as {
    id: string;
    note: string;
    created_at: string;
    author: { full_name: string | null; nickname: string | null } | null;
    event: { title: string; starts_at: string } | null;
  }[]).map((r) => ({
    id: r.id,
    note: r.note,
    authorName: r.author?.nickname || r.author?.full_name || "Liderança",
    eventTitle: r.event?.title ?? "Culto",
    startsAt: r.event?.starts_at ?? "",
    createdAt: r.created_at,
  }));
}

// =============================================================================
// CUIDADO COM A EQUIPE (visão do líder — quem carrega muito / sumiu / celebra)
// =============================================================================
export type TeamCareMember = { personName: string; served90: number; lastServedAt: string | null };
export type TeamCare = { teamName: string; members: TeamCareMember[]; servedThisMonth: number };

export async function getTeamCare(session: Session): Promise<TeamCare[]> {
  const leadIds = session.profile.teams.filter((t) => t.role === "leader").map((t) => t.id);
  if (leadIds.length === 0) return [];
  const supabase = await createClient();

  const nowMs = Date.now();
  const since = new Date(nowMs - 120 * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date(nowMs).toISOString();
  const ninetyAgoMs = nowMs - 90 * 24 * 60 * 60 * 1000;
  const monthStartIso = `${churchDateISO(nowIso).slice(0, 7)}-01`;

  const [{ data: memRows }, { data: asgRows }] = await Promise.all([
    supabase
      .from("memberships")
      .select("team_id, profile:profiles ( id, full_name ), team:teams ( name )")
      .in("team_id", leadIds),
    supabase
      .from("assignments")
      .select("profile_id, team_id, status, events!inner ( starts_at )")
      .in("team_id", leadIds)
      .in("status", ["confirmado", "presente"])
      .gte("events.starts_at", since)
      .lt("events.starts_at", nowIso),
  ]);

  const members = (memRows ?? []) as {
    team_id: string;
    profile: { id: string; full_name: string | null } | null;
    team: { name: string } | null;
  }[];
  const asg = (asgRows ?? []) as {
    profile_id: string | null;
    team_id: string;
    events: { starts_at: string } | null;
  }[];

  const byTeam = new Map<string, TeamCare>();
  const key = (teamId: string, profileId: string) => `${teamId}:${profileId}`;
  const stat = new Map<string, { served90: number; last: string | null }>();
  const monthByTeam = new Map<string, number>();

  for (const a of asg) {
    if (!a.profile_id || !a.events) continue;
    const startsAt = a.events.starts_at;
    const k = key(a.team_id, a.profile_id);
    const s = stat.get(k) ?? { served90: 0, last: null };
    if (new Date(startsAt).getTime() >= ninetyAgoMs) s.served90 += 1;
    if (!s.last || startsAt > s.last) s.last = startsAt;
    stat.set(k, s);
    if (churchDateISO(startsAt) >= monthStartIso) monthByTeam.set(a.team_id, (monthByTeam.get(a.team_id) ?? 0) + 1);
  }

  for (const m of members) {
    if (!m.profile || !m.team) continue;
    const care = byTeam.get(m.team_id) ?? {
      teamName: m.team.name,
      members: [],
      servedThisMonth: monthByTeam.get(m.team_id) ?? 0,
    };
    const s = stat.get(key(m.team_id, m.profile.id)) ?? { served90: 0, last: null };
    care.members.push({
      personName: m.profile.full_name || "Alguém",
      served90: s.served90,
      lastServedAt: s.last,
    });
    byTeam.set(m.team_id, care);
  }

  for (const care of byTeam.values()) {
    care.members.sort((a, b) => b.served90 - a.served90 || (b.lastServedAt ?? "").localeCompare(a.lastServedAt ?? ""));
  }
  return [...byTeam.values()];
}

// Conquistas coletivas: cultos passados em que a equipe fechou a escala 100% CONFIRMADA.
export type TeamAchievements = { teamName: string; fullScales: number; thisMonthFull: number; streak: number };

export async function getTeamAchievements(session: Session): Promise<TeamAchievements[]> {
  const leadIds = session.profile.teams.filter((t) => t.role === "leader").map((t) => t.id);
  if (leadIds.length === 0) return [];
  const supabase = await createClient();

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const since = new Date(nowMs - 180 * 24 * 60 * 60 * 1000).toISOString();
  const monthStartIso = `${churchDateISO(nowIso).slice(0, 7)}-01`;

  const { data: reqRows } = await supabase
    .from("event_requirements")
    .select("id, event_id, team_id, position_id, needed_count, status, events!inner ( starts_at )")
    .in("team_id", leadIds)
    .gte("events.starts_at", since)
    .lt("events.starts_at", nowIso);
  const reqs = (reqRows ?? []) as (ReqRow & { event_id: string; events: { starts_at: string } | null })[];
  if (reqs.length === 0) return [];

  const eventIds = [...new Set(reqs.map((r) => r.event_id))];
  const { data: asgRows } = await supabase
    .from("assignments")
    .select("id, event_id, team_id, position_id, profile_id, status")
    .in("event_id", eventIds)
    .in("team_id", leadIds);
  const asg = (asgRows ?? []) as (AssignRow & { event_id: string })[];

  const startsById = new Map<string, string>();
  for (const r of reqs) if (r.events) startsById.set(r.event_id, r.events.starts_at);

  const teamsMeta = await listTeams();
  const nameById = new Map(teamsMeta.map((t) => [t.id, t.name]));

  const perTeam = new Map<string, { startsAt: string; full: boolean }[]>();
  for (const evId of eventIds) {
    const evReqs = reqs.filter((r) => r.event_id === evId);
    const evAsg = asg.filter((a) => a.event_id === evId);
    const cov = coverageByTeam(evReqs, evAsg);
    for (const teamId of leadIds) {
      const c = cov.get(teamId);
      if (!c || c.needed === 0) continue;
      const arr = perTeam.get(teamId) ?? [];
      arr.push({ startsAt: startsById.get(evId) ?? "", full: c.confirmed >= c.needed });
      perTeam.set(teamId, arr);
    }
  }

  const out: TeamAchievements[] = [];
  for (const [teamId, entries] of perTeam) {
    entries.sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1));
    const fullScales = entries.filter((e) => e.full).length;
    if (fullScales === 0) continue;
    const thisMonthFull = entries.filter((e) => e.full && churchDateISO(e.startsAt) >= monthStartIso).length;
    let streak = 0;
    for (let k = entries.length - 1; k >= 0; k--) {
      if (entries[k].full) streak++;
      else break;
    }
    out.push({ teamName: nameById.get(teamId) ?? "Equipe", fullScales, thisMonthFull, streak });
  }
  return out;
}

// Localização da igreja (pro selo de check-in por GPS).
export type ChurchLocation = { latitude: number | null; longitude: number | null; radiusM: number };
export async function getChurchLocation(session: Session): Promise<ChurchLocation | null> {
  if (!session.profile.church_id) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("churches")
    .select("latitude, longitude, checkin_radius_m")
    .eq("id", session.profile.church_id)
    .maybeSingle();
  if (!data) return null;
  return { latitude: data.latitude, longitude: data.longitude, radiusM: data.checkin_radius_m ?? 200 };
}

// =============================================================================
// CRONOGRAMA (ordem do culto) — blocos por evento
// =============================================================================
export type RundownItem = {
  id: string;
  sortOrder: number;
  title: string;
  kind: string;
  color: string | null;
  durationMin: number;
  responsible: string | null;
  note: string | null;
  link: string | null;
  doneAt: string | null;
  /**
   * Versão do CONTEÚDO (migration 0048). Volta no salvamento pra que uma
   * alteração feita por outra pessoa no meio do caminho seja RECUSADA em vez de
   * sobrescrita em silêncio.
   */
  contentUpdatedAt: string;
  /** Quem apertou "Editar" — aviso, não bloqueio. `null` quando ninguém está. */
  editingBy: string | null;
  editingAt: string | null;
  /** Nome de quem está editando, já resolvido pra a UI não ter que buscar. */
  editingNome: string | null;
};

/**
 * Nome de um perfil embutido numa consulta. O PostgREST devolve o embed de uma
 * FK como objeto, mas os tipos gerados às vezes o inferem como array (depende de
 * ele conseguir provar que é para-um) — normalizar aqui evita espalhar `[0]` e
 * casts pelo código.
 */
function nomeDoPerfil(v: unknown): string | null {
  const p = (Array.isArray(v) ? v[0] : v) as
    | { nickname?: string | null; full_name?: string | null }
    | null
    | undefined;
  return p?.nickname || p?.full_name || null;
}

export async function getEventRundown(eventId: string): Promise<RundownItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("event_rundown")
    .select(
      "id, sort_order, title, kind, color, duration_min, responsible, note, link, done_at, content_updated_at, editing_by, editing_at, editor:profiles!event_rundown_editing_by_fkey ( nickname, full_name )",
    )
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true });
  return ((data ?? []) as unknown as {
    id: string;
    sort_order: number;
    title: string;
    kind: string;
    color: string | null;
    duration_min: number;
    responsible: string | null;
    note: string | null;
    link: string | null;
    done_at: string | null;
    content_updated_at: string;
    editing_by: string | null;
    editing_at: string | null;
    editor: unknown;
  }[]).map((r) => ({
    id: r.id,
    sortOrder: r.sort_order,
    title: r.title,
    kind: r.kind,
    color: r.color,
    durationMin: r.duration_min,
    responsible: r.responsible,
    note: r.note,
    link: r.link,
    doneAt: r.done_at,
    contentUpdatedAt: r.content_updated_at,
    editingBy: r.editing_by,
    editingAt: r.editing_at,
    editingNome: nomeDoPerfil(r.editor),
  }));
}

/** Estado do modo ao vivo do cronograma: início real e encerramento. */
export async function getRundownState(eventId: string): Promise<{ startedAt: string | null; endedAt: string | null }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("rundown_started_at, rundown_ended_at")
    .eq("id", eventId)
    .maybeSingle();
  return { startedAt: data?.rundown_started_at ?? null, endedAt: data?.rundown_ended_at ?? null };
}

export type CandidatoRoteiro = {
  ev: EventListItem;
  startedAt: string | null;
  endedAt: string | null;
};

// A DECISÃO de qual culto abrir mora em `roteiro-escolha.ts` (pura, testável
// sem Supabase). Aqui fica só a BUSCA. Reexportado pra que as páginas continuem
// importando tudo de um lugar só.
export { escolherCulto, ehDeHoje, jaPassou } from "@/lib/roteiro-escolha";

/**
 * Os cultos que a aba Roteiro e a régia podem mostrar, com o estado do modo ao
 * vivo junto. Ao vivo primeiro, depois os próximos — a mesma lista nas duas
 * telas, pra elas nunca discordarem sobre qual culto existe.
 */
export async function listarCandidatosDeRoteiro(
  session: Session,
  limite = 8,
): Promise<CandidatoRoteiro[]> {
  const [live, futuros] = await Promise.all([
    listLiveRundownEvents(session),
    listUpcomingEvents(session, limite),
  ]);
  const vistos = new Set<string>();
  const evs = [...live, ...futuros].filter((e) => (vistos.has(e.id) ? false : vistos.add(e.id)));
  const estados = await Promise.all(evs.map((e) => getRundownState(e.id)));
  return evs.map((ev, i) => ({ ev, ...estados[i] }));
}


// --- Mensagem no monitor de palco (migration 0050) -------------------------

export type StageMessageData = { id: string; texto: string; autor: string | null; expiresAt: string };

/**
 * A mensagem que está NO MONITOR agora — uma por igreja, viva e não expirada.
 *
 * A expiração é filtrada aqui e não por rotina de limpeza: a linha vira
 * histórico sozinha quando o `expires_at` passa, então não existe estado
 * "no banco diz que está no ar, mas já saiu".
 */
export async function getStageMessage(churchId: string | null): Promise<StageMessageData | null> {
  if (!churchId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("stage_messages")
    .select("id, texto, expires_at, autor:profiles ( nickname, full_name )")
    .eq("church_id", churchId)
    .is("cleared_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const r = data as unknown as { id: string; texto: string; expires_at: string; autor: unknown };
  return { id: r.id, texto: r.texto, autor: nomeDoPerfil(r.autor), expiresAt: r.expires_at };
}

/** Atalhos de mensagem da igreja (máx. 6, ver 0050). */
export async function listStageShortcuts(churchId: string | null): Promise<{ id: string; label: string }[]> {
  if (!churchId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("stage_shortcuts")
    .select("id, label")
    .eq("church_id", churchId)
    .order("sort_order", { ascending: true });
  return (data ?? []) as { id: string; label: string }[];
}

export type RundownKind = { id: string; label: string; color: string };

/** Tipos de bloco cadastrados pela igreja (para o seletor de tipo do cronograma). */
export async function listRundownKinds(): Promise<RundownKind[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rundown_kinds")
    .select("id, label, color")
    .order("sort_order", { ascending: true });
  return ((data ?? []) as { id: string; label: string; color: string }[]).map((k) => ({
    id: k.id,
    label: k.label,
    color: k.color,
  }));
}

export type RundownTemplateItem = {
  kind: string;
  title: string;
  color: string | null;
  durationMin: number;
  note: string | null;
};
export type RundownTemplate = { id: string; name: string; items: RundownTemplateItem[] };

/** Modelos de cronograma (presets de blocos) da igreja. */
export async function listRundownTemplates(): Promise<RundownTemplate[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("rundown_templates").select("id, name, items").order("name");
  return ((data ?? []) as { id: string; name: string; items: unknown }[]).map((t) => ({
    id: t.id,
    name: t.name,
    items: Array.isArray(t.items) ? (t.items as RundownTemplateItem[]) : [],
  }));
}

// =============================================================================
// DETALHE DO EVENTO (agrupado por equipe -> posição -> vagas)
// =============================================================================
export type SlotPerson = {
  assignmentId: string;
  profileId: string | null;
  name: string;
  avatarUrl: string | null;
  phone: string | null;
  status: AssignmentStatus;
  declineReason: string | null;
  isMe: boolean;
  checkedIn: boolean;
  swap: { id: string; reason: string | null; suggestedName: string | null; acceptedBySub: boolean } | null;
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
  /** Só observa: não gerencia e não é membro desta equipe (outra equipe do mesmo culto). */
  viewOnly: boolean;
  needed: number;
  assigned: number;
  confirmed: number;
  tone: CoverageTone;
  whatsappGroup: string | null;
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
  isResponsible: boolean;
  confirmedAt: string | null;
  confirmedByName: string | null;
  callTime: string | null;
  archivedAt: string | null;
  latitude: number | null;
  longitude: number | null;
  teams: DetailTeam[];
  addableTeams: { id: string; name: string; color: string }[];
};

export async function getEventDetail(session: Session, eventId: string): Promise<EventDetail | null> {
  const supabase = await createClient();
  const { data: ev } = await supabase
    .from("events")
    .select(
      "id, title, starts_at, ends_at, call_time, archived_at, latitude, longitude, location, notes, series_id, responsible_id, confirmed_at, responsible:profiles!events_responsible_id_fkey ( full_name ), confirmer:profiles!events_confirmed_by_fkey ( full_name )",
    )
    .eq("id", eventId)
    .maybeSingle();
  if (!ev) return null;

  const [{ data: reqs }, escala, teams] = await Promise.all([
    supabase
      .from("event_requirements")
      .select("id, team_id, position_id, needed_count, status, note, position:positions ( name, sort_order )")
      .eq("event_id", eventId),
    // migration 0054 — o líder vê o CULTO INTEIRO (as outras equipes, em modo
    // leitura). A RPC já mascara telefone e justificativa de quem não gerencia
    // a equipe; o app remascara embaixo (cinto e suspensório) e cobre o
    // caminho de fallback abaixo.
    supabase.rpc("escala_do_culto", { p_event: eventId }),
    listTeams(),
  ]);

  // Rede de proteção do deploy (decisão do dono, DECISOES-LIDER.md #6): se a
  // RPC falhar — por exemplo, a migration 0054 ainda não foi aplicada quando
  // este código já subiu —, cai na leitura direta de hoje (só as equipes do
  // próprio usuário) em vez de deixar a escala INTEIRA sumir da tela. Mesma
  // família de falha silenciosa das migrations 0029 e 0049. Pode sair depois
  // que a 0054 estiver confirmada em produção.
  let assignRows: {
    id: string;
    team_id: string;
    position_id: string;
    profile_id: string | null;
    status: AssignmentStatus;
    decline_reason: string | null;
    full_name: string | null;
    avatar_url: string | null;
    phone: string | null;
  }[];
  if (escala.error) {
    console.error("[getEventDetail] escala_do_culto falhou, usando fallback de leitura direta:", escala.error);
    const { data: assigns } = await supabase
      .from("assignments")
      .select(
        "id, team_id, position_id, profile_id, status, decline_reason, profile:profiles!assignments_profile_id_fkey ( full_name, avatar_url, phone )",
      )
      .eq("event_id", eventId);
    assignRows = (
      (assigns ?? []) as {
        id: string;
        team_id: string;
        position_id: string;
        profile_id: string | null;
        status: AssignmentStatus;
        decline_reason: string | null;
        profile: { full_name: string; avatar_url: string | null; phone: string | null } | null;
      }[]
    ).map((a) => ({
      id: a.id,
      team_id: a.team_id,
      position_id: a.position_id,
      profile_id: a.profile_id,
      status: a.status,
      decline_reason: a.decline_reason,
      full_name: a.profile?.full_name ?? null,
      avatar_url: a.profile?.avatar_url ?? null,
      phone: a.profile?.phone ?? null,
    }));
  } else {
    assignRows = (escala.data ?? []) as typeof assignRows;
  }

  const teamMeta = new Map(teams.map((t) => [t.id, t]));
  const visible = eventVisibleTeamIds(session);
  const canSee = (teamId: string) => visible === null || visible.includes(teamId);
  const canManage = (teamId: string) =>
    session.role === "admin" || session.profile.teams.some((t) => t.id === teamId && t.role === "leader");
  const isMember = (teamId: string) => session.profile.teams.some((t) => t.id === teamId);

  const reqRows = (reqs ?? []) as {
    id: string;
    team_id: string;
    position_id: string;
    needed_count: number;
    status: RequirementStatus;
    note: string | null;
    position: { name: string; sort_order: number } | null;
  }[];

  // Check-ins e trocas pendentes por escalação.
  const assignmentIds = assignRows.map((a) => a.id);
  const checkedInSet = new Set<string>();
  const swapByAssignment = new Map<
    string,
    { id: string; reason: string | null; suggestedName: string | null; acceptedBySub: boolean }
  >();
  if (assignmentIds.length > 0) {
    const [{ data: checkins }, { data: swaps }] = await Promise.all([
      supabase.from("checkins").select("assignment_id").in("assignment_id", assignmentIds),
      supabase
        .from("swap_requests")
        .select(
          "id, assignment_id, reason, status, substitute_accepted_at, suggested:profiles!swap_requests_suggested_profile_id_fkey ( full_name )",
        )
        .in("assignment_id", assignmentIds)
        .eq("status", "pendente"),
    ]);
    for (const c of (checkins ?? []) as { assignment_id: string }[]) checkedInSet.add(c.assignment_id);
    for (const s of (swaps ?? []) as {
      id: string;
      assignment_id: string;
      reason: string | null;
      substitute_accepted_at: string | null;
      suggested: { full_name: string } | null;
    }[]) {
      swapByAssignment.set(s.assignment_id, {
        id: s.id,
        reason: s.reason,
        suggestedName: s.suggested?.full_name ?? null,
        acceptedBySub: !!s.substitute_accepted_at,
      });
    }
  }

  // Agrupa requisitos por equipe (só equipes visíveis).
  const teamIds = Array.from(new Set(reqRows.map((r) => r.team_id))).filter(canSee);

  const detailTeams: DetailTeam[] = teamIds
    .map((teamId) => {
      const meta = teamMeta.get(teamId);
      if (!meta) return null;
      const canMng = canManage(teamId);
      const viewOnly = !canMng && !isMember(teamId);
      const teamReqs = reqRows
        .filter((r) => r.team_id === teamId)
        .sort((a, b) => (a.position?.sort_order ?? 0) - (b.position?.sort_order ?? 0));

      let needed = 0;
      let assigned = 0;
      let confirmed = 0;

      const positions: DetailPosition[] = teamReqs.map((req) => {
        // A escala agora traz o culto inteiro — sem o `team_id` aqui, uma
        // posição pegaria escalação de OUTRA equipe (mesmo id de posição
        // reaproveitado entre equipes).
        const posAssigns = assignRows.filter(
          (a) => a.position_id === req.position_id && a.team_id === teamId && a.profile_id,
        );
        const filled: SlotPerson[] = posAssigns.map((a) => ({
          assignmentId: a.id,
          profileId: a.profile_id,
          name: a.full_name || "Alguém",
          avatarUrl: a.avatar_url,
          // Cinto e suspensório: a RPC já masca quem não gerencia a equipe,
          // mas o app remasca — e é isso que cobre o caminho de fallback.
          phone: canMng ? a.phone : null,
          status: a.status,
          declineReason: canMng ? a.decline_reason : null,
          isMe: a.profile_id === session.userId,
          checkedIn: checkedInSet.has(a.id),
          swap: swapByAssignment.get(a.id) ?? null,
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
        viewOnly,
        needed,
        assigned,
        confirmed,
        tone: confirmTone(needed, confirmed, assigned),
        // Grupo de WhatsApp é "de dentro" da equipe — quem só observa não vê.
        whatsappGroup: viewOnly ? null : meta.whatsapp_group,
        positions: visiblePositions,
      } satisfies DetailTeam;
    })
    .filter((t): t is DetailTeam => t !== null)
    .sort((a, b) => {
      // As equipes do próprio usuário vêm primeiro; as "de fora" (viewOnly) depois.
      if (a.viewOnly !== b.viewOnly) return a.viewOnly ? 1 : -1;
      return (teamMeta.get(a.teamId)?.sort_order ?? 0) - (teamMeta.get(b.teamId)?.sort_order ?? 0);
    });

  const responsible = (ev as { responsible?: { full_name: string } | null }).responsible;
  const confirmer = (ev as { confirmer?: { full_name: string } | null }).confirmer;

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
    isResponsible: ev.responsible_id === session.userId,
    confirmedAt: ev.confirmed_at,
    confirmedByName: confirmer?.full_name ?? null,
    callTime: ev.call_time,
    archivedAt: ev.archived_at,
    latitude: ev.latitude,
    longitude: ev.longitude,
    teams: detailTeams,
    addableTeams:
      session.role === "admin"
        ? teams
            .filter((t) => !reqRows.some((r) => r.team_id === t.id))
            .map((t) => ({ id: t.id, name: t.name, color: t.color }))
        : [],
  };
}

// =============================================================================
// APTOS PARA UMA POSIÇÃO (fluxo escalar do líder)
// =============================================================================
export type EligibleMember = {
  profileId: string;
  name: string;
  nickname: string | null;
  avatarUrl: string | null;
  knowsPosition: boolean;
  /** Já escalada em OUTRA equipe neste evento — bloqueio real, sem exceção. */
  blockedOtherTeam: boolean;
  /** Já escalada em outra posição desta MESMA equipe — aviso, dá pra confirmar mesmo assim. */
  alreadyInTeam: boolean;
  unavailable: boolean;
  lastServedISO: string | null;
};

export async function getEligibleMembers(
  eventId: string,
  teamId: string,
  positionId: string,
): Promise<EligibleMember[]> {
  const supabase = await createClient();
  const [{ data: members }, { data: eventAssigns }, { data: ev }] = await Promise.all([
    supabase
      .from("memberships")
      .select("id, profile:profiles ( id, full_name, nickname, avatar_url, status ), member_positions ( position_id )")
      .eq("team_id", teamId),
    supabase.from("assignments").select("profile_id, team_id, status").eq("event_id", eventId),
    supabase.from("events").select("starts_at").eq("id", eventId).maybeSingle(),
  ]);

  const activeAssigns = (eventAssigns ?? []).filter((a) => a.status !== "recusado" && a.profile_id);
  const otherTeamIds = new Set(activeAssigns.filter((a) => a.team_id !== teamId).map((a) => a.profile_id));
  const sameTeamIds = new Set(activeAssigns.filter((a) => a.team_id === teamId).map((a) => a.profile_id));

  const rows = (members ?? []) as {
    id: string;
    profile: { id: string; full_name: string; nickname: string | null; avatar_url: string | null; status: string } | null;
    member_positions: { position_id: string }[];
  }[];
  const activeRows = rows.filter((m) => m.profile && m.profile.status === "ativo");

  // Indisponíveis: bloqueio de disponibilidade cobrindo a data do evento.
  const unavailableIds = new Set<string>();
  const eventDate = ev?.starts_at ? churchDateISO(ev.starts_at) : "";
  const memberIds = activeRows.map((m) => m.profile!.id);
  if (eventDate && memberIds.length > 0) {
    const { data: blocks } = await supabase
      .from("availability_blocks")
      .select("profile_id")
      .in("profile_id", memberIds)
      .lte("start_date", eventDate)
      .gte("end_date", eventDate);
    for (const b of blocks ?? []) unavailableIds.add(b.profile_id);
  }

  // Última vez que cada um serviu NESTA posição (rodízio justo).
  const lastServed = new Map<string, string>();
  if (memberIds.length > 0) {
    const { data: hist } = await supabase
      .from("assignments")
      .select("profile_id, events!inner ( starts_at )")
      .eq("position_id", positionId)
      .in("profile_id", memberIds)
      .in("status", ["confirmado", "presente"])
      .lt("events.starts_at", new Date().toISOString());
    for (const h of (hist ?? []) as { profile_id: string; events: { starts_at: string } | null }[]) {
      if (!h.events || !h.profile_id) continue;
      const cur = lastServed.get(h.profile_id);
      if (!cur || h.events.starts_at > cur) lastServed.set(h.profile_id, h.events.starts_at);
    }
  }

  return activeRows
    .map((m) => ({
      profileId: m.profile!.id,
      name: m.profile!.full_name || "Sem nome",
      nickname: m.profile!.nickname,
      avatarUrl: m.profile!.avatar_url,
      knowsPosition: m.member_positions.some((mp) => mp.position_id === positionId),
      blockedOtherTeam: otherTeamIds.has(m.profile!.id),
      alreadyInTeam: sameTeamIds.has(m.profile!.id),
      unavailable: unavailableIds.has(m.profile!.id),
      lastServedISO: lastServed.get(m.profile!.id) ?? null,
    }))
    .sort((a, b) => {
      if (a.blockedOtherTeam !== b.blockedOtherTeam) return a.blockedOtherTeam ? 1 : -1;
      if (a.unavailable !== b.unavailable) return a.unavailable ? 1 : -1;
      if (a.alreadyInTeam !== b.alreadyInTeam) return a.alreadyInTeam ? 1 : -1;
      if (a.knowsPosition !== b.knowsPosition) return a.knowsPosition ? -1 : 1;
      return a.name.localeCompare(b.name, "pt-BR");
    });
}

export type AvailabilityBlock = {
  id: string;
  startDate: string;
  endDate: string;
  reason: string | null;
};

export async function getMyAvailabilityBlocks(session: Session): Promise<AvailabilityBlock[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("availability_blocks")
    .select("id, start_date, end_date, reason")
    .eq("profile_id", session.userId)
    .gte("end_date", today)
    .order("start_date");
  return ((data ?? []) as { id: string; start_date: string; end_date: string; reason: string | null }[]).map(
    (b) => ({ id: b.id, startDate: b.start_date, endDate: b.end_date, reason: b.reason }),
  );
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
  teamId: string;
  teamName: string;
  teamColor: string;
  callAt: string | null;
  checkedIn: boolean;
};

export async function getMyUpcomingAssignments(session: Session): Promise<MyAssignment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("assignments")
    .select(
      `id, status, decline_reason, team_id,
       events!inner ( id, title, starts_at, location, call_time, archived_at ),
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
    team_id: string;
    events: {
      id: string;
      title: string;
      starts_at: string;
      location: string | null;
      call_time: string | null;
      archived_at: string | null;
    } | null;
    positions: { name: string } | null;
    teams: { name: string; color: string } | null;
  }[];

  const upcoming = rows.filter(
    (r) => r.events && !r.events.archived_at && r.events.starts_at >= cutoff && r.status !== "recusado",
  );

  const ids = upcoming.map((r) => r.id);
  const checkedIn = new Set<string>();
  if (ids.length > 0) {
    const { data: c } = await supabase.from("checkins").select("assignment_id").in("assignment_id", ids);
    for (const row of (c ?? []) as { assignment_id: string }[]) checkedIn.add(row.assignment_id);
  }

  return upcoming
    .map((r) => ({
      assignmentId: r.id,
      status: r.status,
      declineReason: r.decline_reason,
      eventId: r.events!.id,
      eventTitle: r.events!.title,
      startsAt: r.events!.starts_at,
      location: r.events!.location,
      callAt: r.events!.call_time,
      positionName: r.positions?.name || "Posição",
      teamId: r.team_id,
      teamName: r.teams?.name || "Equipe",
      teamColor: r.teams?.color || CATEGORY_PALETTE[0].hex,
      checkedIn: checkedIn.has(r.id),
    }))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

// Pedidos de troca aguardando MINHA resposta (fui sugerido como substituto).
export type SwapInboxItem = {
  swapId: string;
  eventId: string;
  eventTitle: string;
  startsAt: string;
  positionName: string;
  teamName: string;
  requesterName: string;
  reason: string | null;
};

export async function getSwapsAwaitingMe(session: Session): Promise<SwapInboxItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("swap_requests")
    .select(
      `id, reason,
       requester:profiles!swap_requests_requested_by_fkey ( full_name ),
       assignment:assignments!swap_requests_assignment_id_fkey (
         event:events ( id, title, starts_at ),
         position:positions ( name ),
         team:teams ( name )
       )`,
    )
    .eq("suggested_profile_id", session.userId)
    .eq("status", "pendente")
    .is("substitute_accepted_at", null);

  const cutoff = upcomingCutoffIso();
  return ((data ?? []) as {
    id: string;
    reason: string | null;
    requester: { full_name: string } | null;
    assignment: {
      event: { id: string; title: string; starts_at: string } | null;
      position: { name: string } | null;
      team: { name: string } | null;
    } | null;
  }[])
    .filter((s) => s.assignment?.event && s.assignment.event.starts_at >= cutoff)
    .map((s) => ({
      swapId: s.id,
      eventId: s.assignment!.event!.id,
      eventTitle: s.assignment!.event!.title,
      startsAt: s.assignment!.event!.starts_at,
      positionName: s.assignment!.position?.name || "Posição",
      teamName: s.assignment!.team?.name || "Equipe",
      requesterName: s.requester?.full_name || "Alguém",
      reason: s.reason,
    }))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

// =============================================================================
// "FALTA CONFIRMAR" — home de líder/admin (Fase 5 do pós-audit)
// =============================================================================
export type UnconfirmedPerson = {
  assignmentId: string;
  profileId: string;
  name: string;
  avatarUrl: string | null;
  phone: string | null;
  teamName: string;
  positionName: string;
  invitedAt: string;
};

/** Quem está `convidado` (ainda não confirmou) num evento — pro card "Falta
 * confirmar" da home. Líder só vê as equipes que LIDERA (mesmo escopo do
 * `awaitingConfirmation` de `getLeaderHome`, não o de membro comum); admin vê
 * todas. */
export async function listUnconfirmedForEvent(session: Session, eventId: string): Promise<UnconfirmedPerson[]> {
  const isAdmin = session.role === "admin";
  const leadIds = leadTeamIds(session.profile);
  if (!isAdmin && leadIds.length === 0) return [];

  const supabase = await createClient();
  let query = supabase
    .from("assignments")
    .select(
      "id, profile_id, created_at, team:teams ( name ), position:positions ( name ), profile:profiles!assignments_profile_id_fkey ( full_name, avatar_url, phone )",
    )
    .eq("event_id", eventId)
    .eq("status", "convidado")
    .not("profile_id", "is", null);
  if (!isAdmin) query = query.in("team_id", leadIds);

  const { data } = await query;
  return ((data ?? []) as {
    id: string;
    profile_id: string | null;
    created_at: string;
    team: { name: string } | null;
    position: { name: string } | null;
    profile: { full_name: string; avatar_url: string | null; phone: string | null } | null;
  }[])
    .map((r) => ({
      assignmentId: r.id,
      profileId: r.profile_id!,
      name: r.profile?.full_name || "Alguém",
      avatarUrl: r.profile?.avatar_url ?? null,
      phone: r.profile?.phone ?? null,
      teamName: r.team?.name || "Equipe",
      positionName: r.position?.name || "Posição",
      invitedAt: r.created_at,
    }))
    .sort((a, b) => a.invitedAt.localeCompare(b.invitedAt));
}

// =============================================================================
// HOME — LÍDER
// =============================================================================
export type LeaderHome = {
  events: EventListItem[]; // já filtrados pras equipes que ele lidera
  /** Gente da equipe dele que foi aprovada e não entrou — ver `listStuckEntries`. */
  stuckEntries: number;
  openVacancies: number;
  awaitingConfirmation: number;
  interests: {
    id: string;
    teamId: string;
    personName: string;
    teamName: string;
    positionName: string | null;
    note: string | null;
  }[];
  resolvedInterests: {
    id: string;
    personName: string;
    teamName: string;
    status: "atendido" | "arquivado";
    note: string | null;
    resolvedNote: string | null;
    resolvedAt: string | null;
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
  let resolvedInterests: LeaderHome["resolvedInterests"] = [];
  if (leadIds.length > 0) {
    const [{ data }, { data: done }] = await Promise.all([
      supabase
        .from("service_interests")
        .select(
          "id, team_id, note, status, profile:profiles!service_interests_profile_id_fkey ( full_name ), team:teams ( name ), position:positions ( name )",
        )
        .in("team_id", leadIds)
        .eq("status", "aberto")
        .limit(10),
      supabase
        .from("service_interests")
        .select(
          "id, status, note, resolved_note, resolved_at, profile:profiles!service_interests_profile_id_fkey ( full_name ), team:teams ( name )",
        )
        .in("team_id", leadIds)
        .neq("status", "aberto")
        .order("resolved_at", { ascending: false, nullsFirst: false })
        .limit(10),
    ]);
    interests = ((data ?? []) as {
      id: string;
      team_id: string;
      note: string | null;
      profile: { full_name: string } | null;
      team: { name: string } | null;
      position: { name: string } | null;
    }[]).map((i) => ({
      id: i.id,
      teamId: i.team_id,
      personName: i.profile?.full_name || "Alguém",
      teamName: i.team?.name || "Equipe",
      positionName: i.position?.name ?? null,
      note: i.note,
    }));
    resolvedInterests = ((done ?? []) as {
      id: string;
      status: "atendido" | "arquivado";
      note: string | null;
      resolved_note: string | null;
      resolved_at: string | null;
      profile: { full_name: string } | null;
      team: { name: string } | null;
    }[]).map((i) => ({
      id: i.id,
      personName: i.profile?.full_name || "Alguém",
      teamName: i.team?.name || "Equipe",
      status: i.status,
      note: i.note,
      resolvedNote: i.resolved_note,
      resolvedAt: i.resolved_at,
    }));
  }

  return {
    events: leaderEvents,
    stuckEntries: (await listStuckEntries(session)).length,
    openVacancies,
    awaitingConfirmation,
    interests,
    resolvedInterests,
  };
}

// =============================================================================
// HOME — ADMIN
// =============================================================================
export type AdminHome = {
  pendingJoinRequests: number;
  pendingInvites: number;
  /** Gente aprovada que mesmo assim não entrou — ver `listStuckEntries`. */
  stuckEntries: number;
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

  const [{ count: joinCount }, { count: inviteCount }, stuck, { data: awaitingRows }] = await Promise.all([
    supabase.from("join_requests").select("id", { count: "exact", head: true }).eq("status", "pendente"),
    supabase.from("invites").select("id", { count: "exact", head: true }).eq("status", "pendente"),
    // O contador tem que incluir os travados, senão a home diz "tudo certo" com
    // gente presa há dias — que foi exatamente o que aconteceu com o Tiago.
    listStuckEntries(session),
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
    stuckEntries: stuck.length,
    upcomingCount: events.length,
    coverageHoles,
    awaitingResponsible,
    nextEvent: events[0] ?? null,
  };
}

// =============================================================================
// PESSOAS / ONBOARDING (admin)
// =============================================================================
export type MemberTeamRef = {
  membershipId: string;
  teamId: string;
  name: string;
  color: string;
  role: "leader" | "volunteer";
};

// Roster read-only das equipes do próprio usuário (voluntário vê quem serve com ele).
export type RosterMember = {
  profileId: string;
  name: string;
  avatarUrl: string | null;
  phone: string | null;
  role: "leader" | "volunteer";
};
export type MyTeamRoster = { id: string; name: string; color: string; members: RosterMember[] };

export async function getMyTeamsRoster(session: Session): Promise<MyTeamRoster[]> {
  const order = session.profile.teams.map((t) => t.id);
  if (order.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("memberships")
    .select(
      "team_id, role, profile:profiles ( id, full_name, avatar_url, phone, status ), team:teams ( id, name, color, archived_at )",
    )
    .in("team_id", order);
  const rows = (data ?? []) as {
    team_id: string;
    role: "leader" | "volunteer";
    profile: { id: string; full_name: string | null; avatar_url: string | null; phone: string | null; status: string } | null;
    team: { id: string; name: string; color: string; archived_at: string | null } | null;
  }[];

  const teams = new Map<string, MyTeamRoster>();
  for (const r of rows) {
    if (!r.team || r.team.archived_at || !r.profile || r.profile.status !== "ativo") continue;
    let t = teams.get(r.team.id);
    if (!t) {
      t = { id: r.team.id, name: r.team.name, color: r.team.color, members: [] };
      teams.set(r.team.id, t);
    }
    t.members.push({
      profileId: r.profile.id,
      name: r.profile.full_name || "Sem nome",
      avatarUrl: r.profile.avatar_url,
      phone: r.profile.phone,
      role: r.role,
    });
  }
  for (const t of teams.values()) {
    t.members.sort((a, b) => (a.role !== b.role ? (a.role === "leader" ? -1 : 1) : a.name.localeCompare(b.name, "pt-BR")));
  }
  return order.map((id) => teams.get(id)).filter((t): t is MyTeamRoster => !!t);
}

export type MemberRow = {
  id: string;
  fullName: string;
  nickname: string | null;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  avatarUrl: string | null;
  systemRole: string;
  status: string;
  createdAt: string;
  teams: MemberTeamRef[];
};

export async function listMembers(): Promise<MemberRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select(
      "id, full_name, nickname, email, phone, birth_date, avatar_url, system_role, status, created_at, memberships ( id, role, team:teams ( id, name, color, archived_at ) )",
    )
    .order("full_name");
  return ((data ?? []) as {
    id: string;
    full_name: string;
    nickname: string | null;
    email: string | null;
    phone: string | null;
    birth_date: string | null;
    avatar_url: string | null;
    system_role: string;
    status: string;
    created_at: string;
    memberships: {
      id: string;
      role: "leader" | "volunteer";
      team: { id: string; name: string; color: string; archived_at: string | null } | null;
    }[];
  }[]).map((p) => ({
    id: p.id,
    fullName: p.full_name || "Sem nome",
    nickname: p.nickname,
    email: p.email,
    phone: p.phone,
    birthDate: p.birth_date,
    avatarUrl: p.avatar_url,
    systemRole: p.system_role,
    status: p.status,
    createdAt: p.created_at,
    teams: (p.memberships ?? [])
      .filter((m) => m.team && !m.team.archived_at)
      .map((m) => ({
        membershipId: m.id,
        teamId: m.team!.id,
        name: m.team!.name,
        color: m.team!.color,
        role: m.role,
      })),
  }));
}

export type PendingJoin = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  message: string | null;
  desiredTeamId: string | null;
  createdAt: string;
};

/** Pedidos de entrada pendentes (auto-cadastro). Admin vê todos; líder só os
 * que pediram a equipe dele. */
export async function listPendingJoinRequests(session: Session): Promise<PendingJoin[]> {
  const isAdmin = session.role === "admin";
  const leadIds = leadTeamIds(session.profile);
  if (!isAdmin && leadIds.length === 0) return [];
  const supabase = await createClient();
  let q = supabase
    .from("join_requests")
    .select("id, full_name, email, phone, message, desired_team_id, created_at")
    .eq("status", "pendente")
    .order("created_at", { ascending: false });
  if (!isAdmin) q = q.in("desired_team_id", leadIds);
  const { data } = await q;
  return ((data ?? []) as {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    message: string | null;
    desired_team_id: string | null;
    created_at: string;
  }[]).map((j) => ({
    id: j.id,
    fullName: j.full_name,
    email: j.email,
    phone: j.phone,
    message: j.message,
    desiredTeamId: j.desired_team_id,
    createdAt: j.created_at,
  }));
}

export type PendingProfile = {
  id: string;
  fullName: string;
  email: string | null;
  avatarUrl: string | null;
  desiredTeamId: string | null;
  createdAt: string;
};

/** Perfis pendentes (logou sem convite). Admin vê todos; líder só os que
 * pediram a equipe dele. */
export async function listPendingProfiles(session: Session): Promise<PendingProfile[]> {
  const isAdmin = session.role === "admin";
  const leadIds = leadTeamIds(session.profile);
  if (!isAdmin && leadIds.length === 0) return [];
  const supabase = await createClient();
  let q = supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url, desired_team_id, created_at")
    .eq("status", "pendente")
    .order("created_at", { ascending: false });
  if (!isAdmin) q = q.in("desired_team_id", leadIds);
  const { data } = await q;
  return ((data ?? []) as {
    id: string;
    full_name: string;
    email: string | null;
    avatar_url: string | null;
    desired_team_id: string | null;
    created_at: string;
  }[]).map((p) => ({
    id: p.id,
    fullName: p.full_name,
    email: p.email,
    avatarUrl: p.avatar_url,
    desiredTeamId: p.desired_team_id,
    createdAt: p.created_at,
  }));
}

export type InviteRow = {
  id: string;
  email: string;
  fullName: string;
  systemRole: string;
  status: string;
  createdAt: string;
  /** Dias desde o convite — sem isso "pendente" não diz se é de ontem ou de abril. */
  diasEsperando: number;
  /**
   * A pessoa já é membro ativo, apesar do convite seguir `pendente`.
   *
   * Acontece de verdade: o `handle_new_user` só carimba o convite como `aceito`
   * no signup, então quem entrou por OUTRO caminho (ou ANTES de o convite ser
   * criado) deixa a linha pendente pra sempre. Foi o que houve com o Tiago em
   * 21/08 — ele criou a conta às 19:45 e o convite nasceu às 20:27, meia hora
   * DEPOIS, e nunca teve como ser consumido.
   *
   * Uma fila que mostra trabalho que não é trabalho ensina a ignorar a fila.
   */
  jaEntrou: boolean;
  teams: { name: string; color: string; role: string }[];
};

export async function listInvites(): Promise<InviteRow[]> {
  const supabase = await createClient();
  const [{ data }, { data: ativos }] = await Promise.all([
    supabase
      .from("invites")
      .select(
        "id, email, full_name, system_role, status, created_at, invite_teams ( role, team:teams ( name, color ) )",
      )
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("email").eq("status", "ativo"),
  ]);
  const jaMembro = new Set(
    ((ativos ?? []) as { email: string | null }[])
      .map((p) => (p.email ?? "").trim().toLowerCase())
      .filter(Boolean),
  );
  return ((data ?? []) as {
    id: string;
    email: string;
    full_name: string;
    system_role: string;
    status: string;
    created_at: string;
    invite_teams: { role: string; team: { name: string; color: string } | null }[];
  }[]).map((i) => {
    return {
      id: i.id,
      email: i.email,
      fullName: i.full_name,
      systemRole: i.system_role,
      status: i.status,
      createdAt: i.created_at,
      diasEsperando: Math.max(
        0,
        Math.floor((Date.now() - new Date(i.created_at).getTime()) / 86_400_000),
      ),
      jaEntrou: jaMembro.has(i.email.trim().toLowerCase()),
      teams: (i.invite_teams ?? [])
        .filter((t) => t.team)
        .map((t) => ({ name: t.team!.name, color: t.team!.color, role: t.role })),
    };
  });
}

// -----------------------------------------------------------------------------
// ENTRADAS TRAVADAS — "eu já agi e não deu em nada"
// -----------------------------------------------------------------------------
/**
 * POR QUE ISTO EXISTE. As três listas de "Entrando na igreja" (pedido, perfil
 * pendente, convite) perguntam todas a MESMA coisa: "está esperando eu agir?".
 * Quem já foi agido e mesmo assim não entrou some das três de uma vez.
 *
 * Foi o que houve com o Tiago, aprovado em 16/08: pedido virou `aprovado` (some
 * da fila), convite acabou `cancelado` (some da lista de convites), e ele nunca
 * criou conta (não vira perfil pendente). Ficou invisível no app inteiro por 5
 * dias, e só apareceu porque ele reclamou por fora.
 *
 * DOIS ESTADOS, UMA CURA. Reconvidar resolve os dois — por isso não viraram
 * seções separadas:
 *   • `aprovado_sem_chave` — foi aprovado e não existe convite vivo pra ele;
 *   • `link_vencido`       — o convite existe, mas o prazo passou.
 *
 * "NÃO ENTROU" É AUSÊNCIA DE PERFIL ATIVO, não ausência de conta. A Marina e o
 * Gui têm conta no auth (órfã, sem perfil) e nunca entraram de verdade —
 * medir por `auth.users` os daria como resolvidos. E `profiles` é tabela que o
 * app já lê; `auth.users` exigiria uma RPC nova pra dar uma resposta pior.
 *
 * `expires_at` NULO CONTA COMO VENCIDO. Os 39 convites anteriores a 16/08 têm
 * prazo nulo, e a `/auth/entrar/[token]` recusa todos eles (route.ts:71). Um
 * link que a rota recusa está morto — tratar nulo como "não expira" mostraria
 * como saudável exatamente o convite que não abre.
 */
export type StuckEntry = {
  id: string;
  motivo: "aprovado_sem_chave" | "link_vencido";
  fullName: string;
  email: string;
  desiredTeamId: string | null;
  /** Dias desde a aprovação / desde o convite — "travado" sem idade não pauta nada. */
  diasParado: number;
  /** Alvo do Reconvidar. O e-mail NUNCA viaja pelo cliente — ver `reconvidar`. */
  alvo: { tipo: "convite" | "pedido"; id: string };
};

export async function listStuckEntries(session: Session): Promise<StuckEntry[]> {
  const isAdmin = session.role === "admin";
  const leadIds = leadTeamIds(session.profile);
  if (!isAdmin && leadIds.length === 0) return [];
  const supabase = await createClient();

  const [{ data: aprovados }, { data: convites }, { data: ativos }] = await Promise.all([
    supabase
      .from("join_requests")
      .select("id, full_name, email, desired_team_id, created_at")
      .eq("status", "aprovado"),
    supabase
      .from("invites")
      .select("id, email, full_name, created_at, expires_at, invite_teams ( team_id )")
      .eq("status", "pendente"),
    // Só os e-mails: é uma lista de exclusão, não um roster.
    supabase.from("profiles").select("email").eq("status", "ativo"),
  ]);

  const chave = (e: string | null) => (e ?? "").trim().toLowerCase();
  const jaEntrou = new Set((ativos ?? []).map((p) => chave(p.email)).filter(Boolean));
  const agora = Date.now();
  const dias = (iso: string) => Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 86_400_000));

  type ConviteRow = {
    id: string;
    email: string;
    full_name: string | null;
    created_at: string;
    expires_at: string | null;
    invite_teams: { team_id: string }[];
  };
  const conviteRows = (convites ?? []) as ConviteRow[];
  const vivo = (c: ConviteRow) => !!c.expires_at && new Date(c.expires_at).getTime() > agora;
  const comConviteVivo = new Set(conviteRows.filter(vivo).map((c) => chave(c.email)));

  type PedidoRow = {
    id: string;
    full_name: string;
    email: string | null;
    desired_team_id: string | null;
    created_at: string;
  };
  const pedidoRows = ((aprovados ?? []) as PedidoRow[]).filter((j) => chave(j.email));

  // Um pedido do líder é o que pediu a equipe dele. Vale também pra decidir se
  // ele enxerga o CONVITE da mesma pessoa (abaixo).
  const pedidoVisivel = (j: PedidoRow) =>
    isAdmin || (!!j.desired_team_id && leadIds.includes(j.desired_team_id));
  const emailsDosMeusPedidos = new Set(pedidoRows.filter(pedidoVisivel).map((j) => chave(j.email)));

  // Chaveado por e-mail: quem tem pedido aprovado E convite vencido é UMA pessoa
  // travada, não duas linhas. O convite ganha porque carrega o id que o
  // Reconvidar renova em vez de recriar do zero.
  const porEmail = new Map<string, StuckEntry>();

  for (const j of pedidoRows) {
    const email = chave(j.email);
    if (jaEntrou.has(email) || comConviteVivo.has(email)) continue;
    if (!pedidoVisivel(j)) continue;
    porEmail.set(email, {
      id: `s-pedido-${j.id}`,
      motivo: "aprovado_sem_chave",
      fullName: j.full_name,
      email: j.email!,
      desiredTeamId: j.desired_team_id,
      diasParado: dias(j.created_at),
      alvo: { tipo: "pedido", id: j.id },
    });
  }

  for (const c of conviteRows) {
    if (vivo(c)) continue;
    const email = chave(c.email);
    if (!email || jaEntrou.has(email)) continue;
    // Convite sem equipe nenhuma (o `aprovarJoinRequest` cria assim quando não se
    // marca equipe) não teria dono pro líder. Nesse caso o pedido dele responde.
    const meu =
      isAdmin ||
      (c.invite_teams ?? []).some((t) => leadIds.includes(t.team_id)) ||
      emailsDosMeusPedidos.has(email);
    if (!meu) continue;
    porEmail.set(email, {
      id: `s-convite-${c.id}`,
      motivo: "link_vencido",
      fullName: c.full_name || c.email,
      email: c.email,
      desiredTeamId: porEmail.get(email)?.desiredTeamId ?? null,
      diasParado: dias(c.created_at),
      alvo: { tipo: "convite", id: c.id },
    });
  }

  return [...porEmail.values()].sort((a, b) => b.diasParado - a.diasParado);
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

// =============================================================================
// RESPONSÁVEL / INTERESSES / HISTÓRICO
// =============================================================================
export type MyResponsibleEvent = { eventId: string; title: string; startsAt: string; location: string | null };

export async function getEventsAwaitingMyConfirmation(session: Session): Promise<MyResponsibleEvent[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("id, title, starts_at, location")
    .eq("responsible_id", session.userId)
    .is("confirmed_at", null)
    .gte("starts_at", upcomingCutoffIso())
    .order("starts_at");
  return ((data ?? []) as { id: string; title: string; starts_at: string; location: string | null }[]).map((e) => ({
    eventId: e.id,
    title: e.title,
    startsAt: e.starts_at,
    location: e.location,
  }));
}

/** Próximo evento (com cobertura) do qual sou o responsável — alimenta o herói do responsável. */
export async function getMyNextResponsibleEvent(session: Session): Promise<EventListItem | null> {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("id, title, starts_at, location, series_id, responsible_id, responsible:profiles!events_responsible_id_fkey ( full_name )")
    .eq("responsible_id", session.userId)
    .gte("starts_at", upcomingCutoffIso())
    .order("starts_at", { ascending: true })
    .limit(1);
  const list = await assembleEventList(session, (events ?? []) as EventRowLite[]);
  return list[0] ?? null;
}

export type MyInterest = {
  id: string;
  teamId: string;
  teamName: string;
  teamColor: string;
  positionName: string | null;
};

export async function getMyOpenInterests(session: Session): Promise<MyInterest[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("service_interests")
    .select("id, team:teams ( id, name, color ), position:positions ( name )")
    .eq("profile_id", session.userId)
    .eq("status", "aberto");
  return ((data ?? []) as {
    id: string;
    team: { id: string; name: string; color: string } | null;
    position: { name: string } | null;
  }[])
    .filter((i) => i.team)
    .map((i) => ({
      id: i.id,
      teamId: i.team!.id,
      teamName: i.team!.name,
      teamColor: i.team!.color,
      positionName: i.position?.name ?? null,
    }));
}

export type HistoryEvent = {
  eventId: string;
  title: string;
  startsAt: string;
  people: { name: string; positionName: string; teamName: string; teamColor: string; status: AssignmentStatus }[];
};

/** Histórico recente: eventos passados com quem serviu (visível conforme RLS). */
export async function listRecentHistory(): Promise<HistoryEvent[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_assignment_history")
    .select("full_name, position_name, team_id, event_id, event_title, starts_at, status")
    .lt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: false })
    .limit(150);

  const teams = await listTeams();
  const teamMeta = new Map(teams.map((t) => [t.id, t]));
  const rows = (data ?? []) as {
    full_name: string | null;
    position_name: string | null;
    team_id: string | null;
    event_id: string | null;
    event_title: string | null;
    starts_at: string | null;
    status: AssignmentStatus | null;
  }[];

  const map = new Map<string, HistoryEvent>();
  for (const r of rows) {
    if (!r.event_id || !r.full_name || !(r.status === "confirmado" || r.status === "presente")) continue;
    let ev = map.get(r.event_id);
    if (!ev) {
      ev = { eventId: r.event_id, title: r.event_title || "Evento", startsAt: r.starts_at || "", people: [] };
      map.set(r.event_id, ev);
    }
    const meta = r.team_id ? teamMeta.get(r.team_id) : undefined;
    ev.people.push({
      name: r.full_name,
      positionName: r.position_name || "Posição",
      teamName: meta?.name || "Equipe",
      teamColor: meta?.color || CATEGORY_PALETTE[0].hex,
      status: r.status!,
    });
  }
  return Array.from(map.values()).slice(0, 15);
}

export type TeamAssignmentRow = {
  eventId: string;
  startsAt: string;
  eventTitle: string;
  positionName: string;
  profileId: string;
  profileName: string;
  avatarUrl: string | null;
};

/**
 * Escalações de uma equipe no mês (não-recusadas, evento começando no intervalo),
 * já com evento, posição e pessoa — base do "Balanço do mês". A partir daqui dá
 * pra montar tanto a contagem por pessoa quanto o detalhe (quando, em que posição
 * e COM QUEM cada um serviu). A RLS garante que só admin/líder da equipe lê.
 */
export async function listTeamMonthAssignments(
  teamId: string,
  fromIso: string,
  toIso: string,
): Promise<TeamAssignmentRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("assignments")
    .select(
      "profile:profiles!assignments_profile_id_fkey ( id, full_name, avatar_url ), position:positions ( name ), event:events!inner ( id, title, starts_at )",
    )
    .eq("team_id", teamId)
    .neq("status", "recusado")
    .not("profile_id", "is", null)
    .gte("event.starts_at", fromIso)
    .lt("event.starts_at", toIso);
  const rows = (data ?? []) as {
    profile: { id: string; full_name: string | null; avatar_url: string | null } | null;
    position: { name: string } | null;
    event: { id: string; title: string; starts_at: string } | null;
  }[];
  return rows
    .filter((r) => r.profile && r.event)
    .map((r) => ({
      eventId: r.event!.id,
      startsAt: r.event!.starts_at,
      eventTitle: r.event!.title,
      positionName: r.position?.name ?? "—",
      profileId: r.profile!.id,
      profileName: r.profile!.full_name || "Sem nome",
      avatarUrl: r.profile!.avatar_url,
    }));
}
