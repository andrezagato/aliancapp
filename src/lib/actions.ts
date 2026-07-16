"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession, canManageTeam } from "@/lib/auth";
import { getEligibleMembers, type EligibleMember } from "@/lib/data";
import { notify, notifyMany, teamLeaderIds } from "@/lib/notify";
import { sendEmail, conviteEmail, escaladoEmail, siteUrl } from "@/lib/email";
import { churchDateISO, fmtEventWhen } from "@/lib/format";
import type {
  ActionResult,
  CriarConviteInput,
  CriarEventoInput,
  CriarModeloInput,
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
// ONBOARDING: solicitar entrada (auto-cadastro público — sem sessão)
// Passa pelo server (mesma origem) em vez de fetch direto do navegador ao
// Supabase — evita o "Load failed" do Safari e dá erro claro.
// =============================================================================
export async function solicitarEntrada(input: {
  fullName: string;
  email: string;
  phone: string;
  message: string;
}): Promise<ActionResult> {
  const nome = input.fullName.trim();
  if (nome.length < 2) return fail("Informe seu nome completo.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("solicitar_entrada", {
    p_full_name: nome,
    p_email: input.email.trim(),
    p_phone: input.phone.trim(),
    p_message: input.message.trim(),
  });
  if (error) return fail(error.message);
  return ok;
}

// Apelido: a própria pessoa define/edita o próprio (ex.: "Maui").
export async function atualizarApelido(nickname: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const supabase = await createClient();
  const value = nickname.trim();
  const { error } = await supabase.from("profiles").update({ nickname: value || null }).eq("id", session.userId);
  if (error) return fail(error.message);
  revalidatePath("/perfil");
  revalidatePath("/pessoas");
  return ok;
}

// Nome completo: a própria pessoa edita o próprio.
export async function atualizarNome(fullName: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const value = fullName.trim();
  if (value.length < 2) return fail("Informe seu nome.");
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: value }).eq("id", session.userId);
  if (error) return fail(error.message);
  revalidatePath("/perfil");
  revalidatePath("/pessoas");
  return ok;
}

// Marca todas as notificações do usuário como lidas (limpa o sino).
export async function marcarNotificacoesLidas(): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null)
    .eq("recipient_id", session.userId);
  if (error) return fail(error.message);
  return ok;
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
  const { data: ca } = await supabase.from("assignments").select("team_id, event_id").eq("id", assignmentId).maybeSingle();
  if (ca?.team_id) {
    await notifyMany(await teamLeaderIds(ca.team_id), {
      kind: "confirmado",
      title: "Presença confirmada",
      body: `${session.profile.full_name || "Alguém"} confirmou presença.`,
      link: ca.event_id ? `/escalas/${ca.event_id}` : "/inicio",
      teamId: ca.team_id,
      eventId: ca.event_id,
    });
  }
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
  const { data: ra } = await supabase.from("assignments").select("team_id, event_id").eq("id", assignmentId).maybeSingle();
  if (ra?.team_id) {
    await notifyMany(await teamLeaderIds(ra.team_id), {
      kind: "cancelado",
      title: "Alguém não vai poder",
      body: `${session.profile.full_name || "Alguém"} não vai poder: ${reason}`,
      link: ra.event_id ? `/escalas/${ra.event_id}` : "/inicio",
      teamId: ra.team_id,
      eventId: ra.event_id,
    });
  }
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

export async function escalarVoluntario(
  input: EscalarInput,
  override = false,
): Promise<ActionResult & { code?: string }> {
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

  // Trava: pessoa indisponível na data (a menos que o líder confirme override).
  if (!override) {
    const { data: ev } = await supabase
      .from("events")
      .select("starts_at")
      .eq("id", input.eventId)
      .maybeSingle();
    const d = ev?.starts_at ? churchDateISO(ev.starts_at) : "";
    if (d) {
      const { data: blk } = await supabase
        .from("availability_blocks")
        .select("id")
        .eq("profile_id", input.profileId)
        .lte("start_date", d)
        .gte("end_date", d)
        .maybeSingle();
      if (blk) return { ok: false, error: "Essa pessoa marcou indisponível nesse dia.", code: "unavailable" };
    }
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

  await notify({
    recipientId: input.profileId,
    kind: "escalado",
    title: "Você foi escalado",
    body: "Toque para confirmar sua presença.",
    link: `/escalas/${input.eventId}`,
    teamId: input.teamId,
    eventId: input.eventId,
  });

  // E-mail (best-effort) — canal garantido no iPhone, complementa o sino.
  try {
    const [{ data: prof }, { data: evInfo }] = await Promise.all([
      supabase.from("profiles").select("email").eq("id", input.profileId).maybeSingle(),
      supabase.from("events").select("title, starts_at").eq("id", input.eventId).maybeSingle(),
    ]);
    if (prof?.email) {
      const esc = escaladoEmail({
        evento: evInfo?.title ?? "um evento",
        quando: fmtEventWhen(evInfo?.starts_at),
        href: `${siteUrl()}/escalas/${input.eventId}`,
      });
      await sendEmail({ to: prof.email, subject: esc.subject, html: esc.html });
    }
  } catch {
    /* best-effort — falha de e-mail não derruba a escalação */
  }

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

/** Admin adiciona outra equipe a um evento já criado (copia as posições da equipe). */
export async function adicionarEquipeAoEvento(eventId: string, teamId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (session.role !== "admin") return fail("Só o administrador adiciona equipes ao evento.");
  const supabase = await createClient();

  const { data: exists } = await supabase
    .from("event_requirements")
    .select("id")
    .eq("event_id", eventId)
    .eq("team_id", teamId)
    .limit(1)
    .maybeSingle();
  if (exists) return fail("Essa equipe já está no evento.");

  const { data: positions } = await supabase
    .from("positions")
    .select("id, team_id")
    .eq("team_id", teamId)
    .is("archived_at", null);
  const rows = (positions ?? []).map((p) => ({
    event_id: eventId,
    team_id: p.team_id,
    position_id: p.id,
    needed_count: 1,
    status: "needed" as const,
  }));
  if (rows.length === 0) return fail("Essa equipe não tem posições cadastradas.");

  const { error } = await supabase.from("event_requirements").insert(rows);
  if (error) return fail(error.message);
  revalidatePath(`/escalas/${eventId}`);
  revalidatePath("/escalas");
  return ok;
}

// =============================================================================
// RESPONSÁVEL DO EVENTO
// =============================================================================
export async function definirResponsavel(eventId: string, profileId: string | null): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (session.role !== "admin") return fail("Só o administrador define o responsável.");
  const supabase = await createClient();
  // Trocar o responsável zera a confirmação anterior.
  const { error } = await supabase
    .from("events")
    .update({ responsible_id: profileId, confirmed_at: null, confirmed_by: null })
    .eq("id", eventId);
  if (error) return fail(error.message);
  revalidatePath(`/escalas/${eventId}`);
  revalidatePath("/inicio");
  return ok;
}

export async function confirmarEvento(eventId: string, confirmar: boolean): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirmar_evento", { p_event: eventId, p_confirmar: confirmar });
  if (error) return fail(error.message);
  revalidatePath(`/escalas/${eventId}`);
  revalidatePath("/inicio");
  return ok;
}

// =============================================================================
// INTERESSES DE SERVIR
// =============================================================================
export async function criarInteresse(
  teamId: string,
  positionId: string | null,
  note?: string,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (!teamId) return fail("Escolha uma equipe.");
  const supabase = await createClient();
  const { error } = await supabase.from("service_interests").insert({
    profile_id: session.userId,
    team_id: teamId,
    position_id: positionId,
    note: note?.trim() || null,
  });
  if (error) {
    return fail(error.message.includes("duplicate") ? "Você já sinalizou interesse aí." : error.message);
  }
  const leaders = await teamLeaderIds(teamId);
  await notifyMany(leaders, {
    kind: "interesse_servir",
    title: "Novo interesse em servir",
    body: `${session.profile.full_name || "Alguém"} quer servir na sua equipe.`,
    link: "/inicio",
    teamId,
  });
  revalidatePath("/inicio");
  return ok;
}

export async function resolverInteresse(
  id: string,
  status: "atendido" | "arquivado",
  teamId: string,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (!canManageTeam(session, teamId)) return fail("Sem permissão.");
  const supabase = await createClient();
  const { error } = await supabase.from("service_interests").update({ status }).eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/inicio");
  return ok;
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

  // E-mail de convite (best-effort) — resolve o "convite não avisa ninguém":
  // a pessoa ainda não é usuária, então o sino não alcança; o e-mail chega sozinho.
  const convite = conviteEmail({
    nome: input.fullName.trim(),
    href: `${siteUrl()}/entrar`,
  });
  await sendEmail({ to: email, subject: convite.subject, html: convite.html });

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

  await notify({
    recipientId: input.profileId,
    kind: "cadastro_aprovado",
    title: "Bem-vindo! Seu acesso foi liberado",
    body: "Você já pode ver suas escalas e servir.",
    link: "/inicio",
  });

  revalidatePath("/pessoas");
  revalidatePath("/inicio");
  return ok;
}

// =============================================================================
// EQUIPES / POSIÇÕES (admin cria equipe; admin ou líder gerencia posições)
// =============================================================================
export async function criarEquipe(name: string, color?: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (session.role !== "admin") return fail("Só o administrador cria equipes.");
  if (!session.profile.church_id) return fail("Sua conta não está ligada a uma igreja.");
  const nome = name.trim();
  if (!nome) return fail("Dê um nome à equipe.");

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("teams")
    .select("sort_order")
    .eq("church_id", session.profile.church_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("teams").insert({
    church_id: session.profile.church_id,
    name: nome,
    color: color?.trim() || "#5B6B4E",
    sort_order: (last?.sort_order ?? 0) + 1,
  });
  if (error) return fail(error.message);
  revalidatePath("/equipes");
  return ok;
}

export async function criarPosicao(teamId: string, name: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (!canManageTeam(session, teamId)) return fail("Você não gerencia esta equipe.");
  const nome = name.trim();
  if (!nome) return fail("Dê um nome à posição.");

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("positions")
    .select("sort_order")
    .eq("team_id", teamId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("positions").insert({
    team_id: teamId,
    name: nome,
    sort_order: (last?.sort_order ?? 0) + 1,
  });
  if (error) return fail(error.message);
  revalidatePath("/equipes");
  return ok;
}

export async function renomearPosicao(positionId: string, name: string, teamId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (!canManageTeam(session, teamId)) return fail("Você não gerencia esta equipe.");
  const nome = name.trim();
  if (!nome) return fail("O nome não pode ficar vazio.");
  const supabase = await createClient();
  const { error } = await supabase.from("positions").update({ name: nome }).eq("id", positionId);
  if (error) return fail(error.message);
  revalidatePath("/equipes");
  return ok;
}

/** Arquiva (soft-delete) ou reativa uma posição — preserva histórico. */
export async function arquivarPosicao(positionId: string, teamId: string, arquivar: boolean): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (!canManageTeam(session, teamId)) return fail("Você não gerencia esta equipe.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("positions")
    .update({ archived_at: arquivar ? new Date().toISOString() : null })
    .eq("id", positionId);
  if (error) return fail(error.message);
  revalidatePath("/equipes");
  return ok;
}

// =============================================================================
// MEMBROS DA EQUIPE (admin ou líder da equipe)
// =============================================================================
export async function adicionarMembro(
  teamId: string,
  profileId: string,
  role: "leader" | "volunteer" = "volunteer",
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (!canManageTeam(session, teamId)) return fail("Você não gerencia esta equipe.");
  const supabase = await createClient();

  const { data: exists } = await supabase
    .from("memberships")
    .select("id")
    .eq("team_id", teamId)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (exists) return fail("Essa pessoa já está na equipe.");

  const { error } = await supabase.from("memberships").insert({ team_id: teamId, profile_id: profileId, role });
  if (error) return fail(error.message);
  revalidatePath("/equipes");
  return ok;
}

export async function definirPapelMembro(
  membershipId: string,
  teamId: string,
  role: "leader" | "volunteer",
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (!canManageTeam(session, teamId)) return fail("Você não gerencia esta equipe.");
  const supabase = await createClient();
  const { error } = await supabase.from("memberships").update({ role }).eq("id", membershipId);
  if (error) return fail(error.message);
  revalidatePath("/equipes");
  revalidatePath("/inicio");
  return ok;
}

export async function removerMembro(membershipId: string, teamId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (!canManageTeam(session, teamId)) return fail("Você não gerencia esta equipe.");
  const supabase = await createClient();
  const { error } = await supabase.from("memberships").delete().eq("id", membershipId);
  if (error) return fail(error.message);
  revalidatePath("/equipes");
  return ok;
}

// =============================================================================
// MODELOS DE EVENTO (admin) — event_series + series_teams
// =============================================================================
export async function criarModelo(input: CriarModeloInput): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (session.role !== "admin") return fail("Só o administrador cria modelos.");
  if (!session.profile.church_id) return fail("Sua conta não está ligada a uma igreja.");
  const nome = input.name.trim();
  if (!nome) return fail("Dê um nome ao modelo.");
  const teamIds = (input.teamIds ?? []).filter(Boolean);
  if (teamIds.length === 0) return fail("Escolha pelo menos uma equipe.");

  const supabase = await createClient();
  const { data: series, error } = await supabase
    .from("event_series")
    .insert({
      church_id: session.profile.church_id,
      title: nome,
      start_time: input.time || "18:00",
      location: input.location?.trim() || null,
    })
    .select("id")
    .single();
  if (error || !series) return fail(error?.message || "Não consegui criar o modelo.");

  const { error: stErr } = await supabase
    .from("series_teams")
    .insert(teamIds.map((teamId) => ({ series_id: series.id, team_id: teamId })));
  if (stErr) return fail(stErr.message);

  revalidatePath("/modelos");
  revalidatePath("/escalas/novo");
  return ok;
}

export async function excluirModelo(seriesId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session || session.role !== "admin") return fail("Sem permissão.");
  const supabase = await createClient();
  const { error } = await supabase.from("event_series").delete().eq("id", seriesId);
  if (error) return fail(error.message);
  revalidatePath("/modelos");
  revalidatePath("/escalas/novo");
  return ok;
}

// =============================================================================
// DISPONIBILIDADE (voluntário marca quando NÃO pode)
// =============================================================================
export async function adicionarIndisponibilidade(
  startDate: string,
  endDate: string,
  reason?: string,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const start = startDate;
  const end = endDate || startDate;
  if (!start) return fail("Escolha ao menos uma data.");
  if (end < start) return fail("A data final não pode ser antes da inicial.");
  const supabase = await createClient();
  const { error } = await supabase.from("availability_blocks").insert({
    profile_id: session.userId,
    start_date: start,
    end_date: end,
    reason: reason?.trim() || null,
  });
  if (error) return fail(error.message);
  revalidatePath("/disponibilidade");
  return ok;
}

export async function removerIndisponibilidade(id: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("availability_blocks")
    .delete()
    .eq("id", id)
    .eq("profile_id", session.userId);
  if (error) return fail(error.message);
  revalidatePath("/disponibilidade");
  return ok;
}

// =============================================================================
// CHECK-IN (presença no dia — auto-declarada)
// =============================================================================
export async function fazerCheckin(assignmentId: string, teamId: string, eventId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const supabase = await createClient();
  const { data: a } = await supabase.from("assignments").select("profile_id").eq("id", assignmentId).maybeSingle();
  const isSelf = a?.profile_id === session.userId;
  if (!isSelf && !canManageTeam(session, teamId)) return fail("Sem permissão.");
  const { error } = await supabase
    .from("checkins")
    .insert({ assignment_id: assignmentId, checked_by: session.userId });
  if (error && !error.message.includes("duplicate")) return fail(error.message);
  revalidatePath(`/escalas/${eventId}`);
  return ok;
}

export async function desfazerCheckin(assignmentId: string, teamId: string, eventId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const supabase = await createClient();
  const { data: a } = await supabase.from("assignments").select("profile_id").eq("id", assignmentId).maybeSingle();
  const isSelf = a?.profile_id === session.userId;
  if (!isSelf && !canManageTeam(session, teamId)) return fail("Sem permissão.");
  const { error } = await supabase.from("checkins").delete().eq("assignment_id", assignmentId);
  if (error) return fail(error.message);
  revalidatePath(`/escalas/${eventId}`);
  return ok;
}

// =============================================================================
// TROCA / SUBSTITUTO (swap_requests)
// =============================================================================
export async function listMembrosParaTroca(
  teamId: string,
): Promise<{ profileId: string; name: string; avatarUrl: string | null }[]> {
  const session = await getSession();
  if (!session) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("memberships")
    .select("profile:profiles ( id, full_name, avatar_url, status )")
    .eq("team_id", teamId);
  return ((data ?? []) as { profile: { id: string; full_name: string; avatar_url: string | null; status: string } | null }[])
    .filter((m) => m.profile && m.profile.status === "ativo" && m.profile.id !== session.userId)
    .map((m) => ({ profileId: m.profile!.id, name: m.profile!.full_name || "Sem nome", avatarUrl: m.profile!.avatar_url }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function pedirTroca(
  assignmentId: string,
  reason: string,
  suggestedProfileId: string | null,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const motivo = reason.trim();
  if (motivo.length < 3) return fail("Conte rapidinho o motivo da troca.");
  const supabase = await createClient();

  const { data: a } = await supabase
    .from("assignments")
    .select("profile_id, event_id, team_id")
    .eq("id", assignmentId)
    .maybeSingle();
  if (!a) return fail("Escalação não encontrada.");
  if (a.profile_id !== session.userId) return fail("Você só pode pedir troca da sua própria escala.");

  const { data: existing } = await supabase
    .from("swap_requests")
    .select("id")
    .eq("assignment_id", assignmentId)
    .eq("status", "pendente")
    .maybeSingle();
  if (existing) return fail("Você já tem um pedido de troca em aberto para esta escala.");

  const { error } = await supabase.from("swap_requests").insert({
    assignment_id: assignmentId,
    requested_by: session.userId,
    suggested_profile_id: suggestedProfileId,
    reason: motivo,
  });
  if (error) return fail(error.message);

  const swapLink = `/escalas/${a.event_id}`;
  await notifyMany(await teamLeaderIds(a.team_id), {
    kind: "troca_solicitada",
    title: "Pedido de troca",
    body: `${session.profile.full_name || "Alguém"} pediu troca de escala.`,
    link: swapLink,
    teamId: a.team_id,
    eventId: a.event_id,
  });
  if (suggestedProfileId) {
    await notify({
      recipientId: suggestedProfileId,
      kind: "troca_solicitada",
      title: "Pediram você como substituto",
      body: `${session.profile.full_name || "Alguém"} sugeriu você pra cobrir. Topa?`,
      link: swapLink,
      teamId: a.team_id,
      eventId: a.event_id,
    });
  }

  revalidatePath(`/escalas/${a.event_id}`);
  revalidatePath("/inicio");
  return ok;
}

export async function resolverTroca(swapId: string, aprovar: boolean, eventId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const supabase = await createClient();

  const { data: swap } = await supabase
    .from("swap_requests")
    .select("id, assignment_id, suggested_profile_id, status, substitute_accepted_at, requested_by")
    .eq("id", swapId)
    .maybeSingle();
  if (!swap) return fail("Pedido de troca não encontrado.");
  if (swap.status !== "pendente") return fail("Esse pedido já foi resolvido.");

  const { data: a } = await supabase
    .from("assignments")
    .select("id, team_id")
    .eq("id", swap.assignment_id)
    .maybeSingle();
  if (!a) return fail("Escalação não encontrada.");
  if (!canManageTeam(session, a.team_id)) return fail("Você não gerencia esta equipe.");

  if (aprovar && swap.suggested_profile_id && !swap.substitute_accepted_at) {
    return fail("O substituto sugerido ainda não aceitou a troca.");
  }

  if (aprovar) {
    if (swap.suggested_profile_id) {
      // Passa a vaga para o substituto sugerido (convidado).
      const { error } = await supabase
        .from("assignments")
        .update({
          profile_id: swap.suggested_profile_id,
          status: "convidado",
          decline_reason: null,
          responded_at: null,
          assigned_by: session.userId,
        })
        .eq("id", a.id);
      if (error) return fail(error.message);
    } else {
      // Sem substituto: abre a vaga.
      const { error } = await supabase
        .from("assignments")
        .update({ profile_id: null, status: "vaga_aberta", decline_reason: null, responded_at: null })
        .eq("id", a.id);
      if (error) return fail(error.message);
    }
  }

  const { error: sErr } = await supabase
    .from("swap_requests")
    .update({ status: aprovar ? "aprovada" : "recusada", resolved_by: session.userId })
    .eq("id", swapId);
  if (sErr) return fail(sErr.message);

  await notify({
    recipientId: swap.requested_by,
    kind: "troca_resolvida",
    title: aprovar ? "Sua troca foi aprovada" : "Troca não aprovada",
    body: aprovar ? "Você foi liberado dessa escala." : "O líder não aprovou — você segue escalado.",
    link: `/escalas/${eventId}`,
    teamId: a.team_id,
    eventId,
  });

  revalidatePath(`/escalas/${eventId}`);
  revalidatePath("/inicio");
  return ok;
}

/** O substituto sugerido aceita a indicação (falta só o líder aprovar). */
export async function aceitarSubstituicao(swapId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const supabase = await createClient();
  const { data: swap } = await supabase
    .from("swap_requests")
    .select(
      "id, suggested_profile_id, status, assignment:assignments!swap_requests_assignment_id_fkey ( event_id )",
    )
    .eq("id", swapId)
    .maybeSingle();
  if (!swap) return fail("Pedido não encontrado.");
  if (swap.suggested_profile_id !== session.userId) return fail("Esse pedido não é pra você.");
  if (swap.status !== "pendente") return fail("Esse pedido já foi resolvido.");

  const { error } = await supabase
    .from("swap_requests")
    .update({ substitute_accepted_at: new Date().toISOString() })
    .eq("id", swapId);
  if (error) return fail(error.message);

  const eventId = (swap.assignment as { event_id: string } | null)?.event_id;
  revalidatePath("/inicio");
  if (eventId) revalidatePath(`/escalas/${eventId}`);
  return ok;
}

/** O substituto sugerido recusa a indicação (o pedido morre). */
export async function recusarSubstituicao(swapId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const supabase = await createClient();
  const { data: swap } = await supabase
    .from("swap_requests")
    .select(
      "id, suggested_profile_id, status, assignment:assignments!swap_requests_assignment_id_fkey ( event_id )",
    )
    .eq("id", swapId)
    .maybeSingle();
  if (!swap) return fail("Pedido não encontrado.");
  if (swap.suggested_profile_id !== session.userId) return fail("Esse pedido não é pra você.");
  if (swap.status !== "pendente") return fail("Esse pedido já foi resolvido.");

  const { error } = await supabase
    .from("swap_requests")
    .update({ status: "recusada", resolved_by: session.userId })
    .eq("id", swapId);
  if (error) return fail(error.message);

  const eventId = (swap.assignment as { event_id: string } | null)?.event_id;
  revalidatePath("/inicio");
  if (eventId) revalidatePath(`/escalas/${eventId}`);
  return ok;
}
