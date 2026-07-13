"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession, canManageTeam } from "@/lib/auth";
import { getEligibleMembers, type EligibleMember } from "@/lib/data";
import type {
  ActionResult,
  CriarConviteInput,
  CriarEventoInput,
  EscalarInput,
  AprovarProfileInput,
} from "@/lib/types";

const ok: ActionResult = { ok: true };
const fail = (error: string): ActionResult => ({ ok: false, error });

// Brasil não tem horário de verão desde 2019 -> offset fixo -03:00.
// (Quando virar multi-igreja, derivar do timezone da igreja.)
function saoPauloToIso(date: string, time: string): string {
  const d = new Date(`${date}T${time}:00-03:00`);
  if (Number.isNaN(d.getTime())) throw new Error("Data/hora inválida");
  return d.toISOString();
}

// =============================================================================
// VOLUNTÁRIO: confirmar / recusar (via RPC security definer)
// =============================================================================
export async function confirmarEscalacao(assignmentId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirmar_escalacao", { p_assignment: assignmentId });
  if (error) return fail(error.message);
  revalidatePath("/inicio");
  revalidatePath("/escalas");
  return ok;
}

export async function recusarEscalacao(assignmentId: string, motivo: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const reason = motivo.trim();
  if (reason.length < 3) return fail("Conte rapidinho o motivo (ajuda o líder a remanejar).");
  const supabase = await createClient();
  const { error } = await supabase.rpc("recusar_escalacao", {
    p_assignment: assignmentId,
    p_motivo: reason,
  });
  if (error) return fail(error.message);
  revalidatePath("/inicio");
  revalidatePath("/escalas");
  return ok;
}

// =============================================================================
// LÍDER / ADMIN: escalar, remover, "não se aplica"
// =============================================================================
/** Lista os aptos de uma posição (para o diálogo de escalar do líder). */
export async function buscarElegiveis(
  eventId: string,
  teamId: string,
  positionId: string,
): Promise<EligibleMember[]> {
  const session = await getSession();
  if (!session || !canManageTeam(session, teamId)) return [];
  return getEligibleMembers(eventId, teamId, positionId);
}

export async function escalarVoluntario(input: EscalarInput): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (!canManageTeam(session, input.teamId)) return fail("Você não gerencia esta equipe.");

  const supabase = await createClient();

  // Evita escalar a mesma pessoa duas vezes na mesma posição/evento.
  const { data: dupes } = await supabase
    .from("assignments")
    .select("id, status")
    .eq("event_id", input.eventId)
    .eq("position_id", input.positionId)
    .eq("profile_id", input.profileId);
  if ((dupes ?? []).some((d) => d.status !== "recusado")) {
    return fail("Essa pessoa já está escalada nesta posição.");
  }

  const { error } = await supabase.from("assignments").insert({
    event_id: input.eventId,
    requirement_id: input.requirementId,
    team_id: input.teamId,
    position_id: input.positionId,
    profile_id: input.profileId,
    status: "convidado",
    assigned_by: session.userId,
  });
  if (error) return fail(error.message);

  revalidatePath(`/escalas/${input.eventId}`);
  revalidatePath("/escalas");
  revalidatePath("/inicio");
  return ok;
}

export async function removerEscalacao(assignmentId: string, eventId: string, teamId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (!canManageTeam(session, teamId)) return fail("Você não gerencia esta equipe.");
  const supabase = await createClient();
  const { error } = await supabase.from("assignments").delete().eq("id", assignmentId);
  if (error) return fail(error.message);
  revalidatePath(`/escalas/${eventId}`);
  revalidatePath("/escalas");
  revalidatePath("/inicio");
  return ok;
}

export async function ajustarNecessario(
  requirementId: string,
  needed: number,
  eventId: string,
  teamId: string,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (!canManageTeam(session, teamId)) return fail("Você não gerencia esta equipe.");
  const n = Math.max(0, Math.min(20, Math.trunc(needed)));
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_requirements")
    .update({ needed_count: n })
    .eq("id", requirementId);
  if (error) return fail(error.message);
  revalidatePath(`/escalas/${eventId}`);
  revalidatePath("/escalas");
  revalidatePath("/inicio");
  return ok;
}

export async function marcarNaoSeAplica(
  requirementId: string,
  naoSeAplica: boolean,
  eventId: string,
  teamId: string,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (!canManageTeam(session, teamId)) return fail("Você não gerencia esta equipe.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_requirements")
    .update({ status: naoSeAplica ? "not_applicable" : "needed" })
    .eq("id", requirementId);
  if (error) return fail(error.message);
  revalidatePath(`/escalas/${eventId}`);
  return ok;
}

// =============================================================================
// ADMIN: criar evento avulso (com requisitos)
// =============================================================================
export async function criarEventoAvulso(input: CriarEventoInput): Promise<ActionResult & { eventId?: string }> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (session.role !== "admin") return fail("Só o administrador cria eventos.");
  if (!session.profile.church_id) return fail("Sua conta não está ligada a uma igreja.");
  if (!input.title.trim()) return fail("Dê um título ao evento.");

  let startsAt: string;
  try {
    startsAt = saoPauloToIso(input.date, input.time || "18:00");
  } catch {
    return fail("Data ou horário inválidos.");
  }

  const teamIds = (input.teamIds ?? []).filter(Boolean);
  if (teamIds.length === 0) return fail("Escolha pelo menos uma equipe.");

  const supabase = await createClient();
  const { data: ev, error } = await supabase
    .from("events")
    .insert({
      church_id: session.profile.church_id,
      title: input.title.trim(),
      starts_at: startsAt,
      location: input.location?.trim() || null,
      notes: input.notes?.trim() || null,
      created_by: session.userId,
    })
    .select("id")
    .single();
  if (error || !ev) return fail(error?.message || "Não consegui criar o evento.");

  // O admin só sinaliza as equipes. Semeamos as posições atuais de cada equipe
  // como SUGESTÃO (needed_count = 1); o líder ajusta quantidades, marca "não se
  // aplica" e escala. As posições vêm do cadastro da equipe (mantido pelo líder).
  const { data: positions } = await supabase
    .from("positions")
    .select("id, team_id")
    .in("team_id", teamIds)
    .is("archived_at", null);

  const rows = (positions ?? []).map((p) => ({
    event_id: ev.id,
    team_id: p.team_id,
    position_id: p.id,
    needed_count: 1,
    status: "needed" as const,
  }));
  if (rows.length > 0) {
    const { error: reqErr } = await supabase.from("event_requirements").insert(rows);
    if (reqErr) return { ...fail(reqErr.message), eventId: ev.id };
  }

  revalidatePath("/escalas");
  revalidatePath("/inicio");
  return { ok: true, eventId: ev.id };
}

// =============================================================================
// ADMIN: convites e aprovações (onboarding de 2 portas)
// =============================================================================
export async function criarConvite(input: CriarConviteInput): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (session.role !== "admin") return fail("Só o administrador convida pessoas.");
  if (!session.profile.church_id) return fail("Sua conta não está ligada a uma igreja.");
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) return fail("Informe um email válido.");

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("invites")
    .select("id")
    .eq("church_id", session.profile.church_id)
    .ilike("email", email)
    .eq("status", "pendente")
    .maybeSingle();
  if (existing) return fail("Já existe um convite pendente para esse email.");

  const { data: inv, error } = await supabase
    .from("invites")
    .insert({
      church_id: session.profile.church_id,
      email,
      full_name: input.fullName.trim(),
      phone: input.phone?.trim() || null,
      system_role: input.systemRole,
      created_by: session.userId,
    })
    .select("id")
    .single();
  if (error || !inv) return fail(error?.message || "Não consegui criar o convite.");

  const teams = (input.teams ?? []).filter((t) => t.teamId);
  if (teams.length > 0) {
    const { error: itErr } = await supabase.from("invite_teams").insert(
      teams.map((t) => ({ invite_id: inv.id, team_id: t.teamId, role: t.role })),
    );
    if (itErr) return fail(itErr.message);
  }

  revalidatePath("/pessoas");
  return ok;
}

export async function cancelarConvite(inviteId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session || session.role !== "admin") return fail("Sem permissão.");
  const supabase = await createClient();
  const { error } = await supabase.from("invites").update({ status: "cancelado" }).eq("id", inviteId);
  if (error) return fail(error.message);
  revalidatePath("/pessoas");
  return ok;
}

/** Aprova um auto-cadastro (pré-login) transformando-o em convite. */
export async function aprovarJoinRequest(joinId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (session.role !== "admin") return fail("Só o administrador aprova cadastros.");
  if (!session.profile.church_id) return fail("Sua conta não está ligada a uma igreja.");
  const supabase = await createClient();

  const { data: jr } = await supabase
    .from("join_requests")
    .select("id, full_name, email")
    .eq("id", joinId)
    .maybeSingle();
  if (!jr) return fail("Solicitação não encontrada.");
  if (!jr.email) return fail("Essa solicitação não tem email — não dá pra casar no login.");

  const email = jr.email.trim().toLowerCase();
  const { data: existing } = await supabase
    .from("invites")
    .select("id")
    .ilike("email", email)
    .eq("status", "pendente")
    .maybeSingle();
  if (!existing) {
    const { error } = await supabase.from("invites").insert({
      church_id: session.profile.church_id,
      email,
      full_name: jr.full_name,
      created_by: session.userId,
    });
    if (error) return fail(error.message);
  }
  await supabase.from("join_requests").update({ status: "aprovado", resolved_by: session.userId }).eq("id", joinId);

  revalidatePath("/pessoas");
  revalidatePath("/inicio");
  return ok;
}

export async function recusarJoinRequest(joinId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session || session.role !== "admin") return fail("Sem permissão.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("join_requests")
    .update({ status: "recusado", resolved_by: session.userId })
    .eq("id", joinId);
  if (error) return fail(error.message);
  revalidatePath("/pessoas");
  return ok;
}

/** Aprova alguém que logou sem convite (profile pendente) -> ativa + equipes. */
export async function aprovarProfilePendente(input: AprovarProfileInput): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (session.role !== "admin") return fail("Só o administrador aprova cadastros.");
  if (!session.profile.church_id) return fail("Sua conta não está ligada a uma igreja.");
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ status: "ativo", church_id: session.profile.church_id })
    .eq("id", input.profileId);
  if (error) return fail(error.message);

  const teams = (input.teams ?? []).filter((t) => t.teamId);
  if (teams.length > 0) {
    const { error: mErr } = await supabase.from("memberships").insert(
      teams.map((t) => ({ profile_id: input.profileId, team_id: t.teamId, role: t.role })),
    );
    if (mErr) return fail(mErr.message);
  }

  revalidatePath("/pessoas");
  revalidatePath("/inicio");
  return ok;
}
