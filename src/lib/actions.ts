"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession, canManageTeam, type Session } from "@/lib/auth";
import { getEligibleMembers, getEventDetail, syncAchievements, type EligibleMember, type DetailTeam } from "@/lib/data";
import { BADGE_BY_CODE, type UnlockedBadge } from "@/lib/achievements";
import { logActivity } from "@/lib/activity";
import { notify, notifyMany, teamLeaderIds } from "@/lib/notify";
import { sendEmail, conviteEmail, escaladoEmail, lembreteEmail, siteUrl } from "@/lib/email";
import { churchDateISO, fmtEventWhen } from "@/lib/format";
import type {
  ActionResult,
  CriarConviteInput,
  CriarEventoInput,
  CriarModeloInput,
  EscalarInput,
  AprovarProfileInput,
  InviteTeamInput,
} from "@/lib/types";

const ok: ActionResult = { ok: true };
const fail = (error: string): ActionResult => ({ ok: false, error });

/**
 * Sincroniza as conquistas do usuário e notifica os desbloqueios novos.
 * Bônus — nunca derruba a ação principal (best-effort). A guarda de 3 evita
 * enxurrada no 1º cálculo (backfill), que a própria página Minha Jornada faz.
 */
async function notificarConquistas(session: Session): Promise<UnlockedBadge[]> {
  try {
    const { newly } = await syncAchievements(session);
    if (newly.length === 0 || newly.length > 3) return [];
    const unlocked: UnlockedBadge[] = [];
    for (const code of newly) {
      const b = BADGE_BY_CODE[code];
      if (!b) continue;
      await notify({
        recipientId: session.userId,
        kind: "conquista",
        title: "🏆 Nova conquista!",
        body: `${b.emoji} ${b.title} — ${b.desc}`,
        link: "/jornada",
      });
      unlocked.push({ code: b.code, emoji: b.emoji, title: b.title, desc: b.desc });
    }
    return unlocked;
  } catch {
    /* conquistas são bônus */
    return [];
  }
}

// Brasil não tem horário de verão desde 2019 -> offset fixo -03:00.
// (Quando virar multi-igreja, derivar do timezone da igreja.)
function saoPauloToIso(date: string, time: string): string {
  const d = new Date(`${date}T${time}:00-03:00`);
  if (Number.isNaN(d.getTime())) throw new Error("Data/hora inválida");
  return d.toISOString();
}

/** Distância em metros entre duas coordenadas (haversine). */
function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
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
  revalidatePath("/equipes");
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
  revalidatePath("/equipes");
  return ok;
}

// Telefone (WhatsApp): a própria pessoa edita o próprio.
export async function atualizarTelefone(phone: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const value = phone.trim();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ phone: value || null }).eq("id", session.userId);
  if (error) return fail(error.message);
  revalidatePath("/perfil");
  revalidatePath("/equipes");
  return ok;
}

/** Admin corrige dados de qualquer pessoa (ex.: convite feito com nome/e-mail errado). */
export async function atualizarPessoaAdmin(
  profileId: string,
  input: { fullName?: string; phone?: string; email?: string },
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (session.role !== "admin") return fail("Só o administrador edita dados de outras pessoas.");
  const patch: { full_name?: string; phone?: string | null; email?: string | null } = {};
  if (input.fullName !== undefined) {
    const v = input.fullName.trim();
    if (v.length < 2) return fail("Informe o nome.");
    patch.full_name = v;
  }
  if (input.phone !== undefined) patch.phone = input.phone.trim() || null;
  if (input.email !== undefined) patch.email = input.email.trim().toLowerCase() || null;
  if (Object.keys(patch).length === 0) return ok;
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(patch).eq("id", profileId);
  if (error) return fail(error.message);
  revalidatePath("/equipes");
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
export async function confirmarEscalacao(
  assignmentId: string,
): Promise<ActionResult & { unlocked?: UnlockedBadge[] }> {
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
  await logActivity({
    profileId: session.userId,
    actorId: session.userId,
    kind: "confirmou",
    eventId: ca?.event_id ?? null,
    teamId: ca?.team_id ?? null,
  });
  const unlocked = await notificarConquistas(session);
  revalidatePath("/inicio");
  revalidatePath("/escalas");
  return { ok: true, unlocked };
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
  await logActivity({
    profileId: session.userId,
    actorId: session.userId,
    kind: "recusou",
    eventId: ra?.event_id ?? null,
    teamId: ra?.team_id ?? null,
    meta: { motivo: reason },
  });
  revalidatePath("/inicio");
  revalidatePath("/escalas");
  return ok;
}

/**
 * Sincroniza conquistas (insere as merecidas) e devolve TODAS as desbloqueadas.
 * Usado pelo "vigia" que comemora no login o que a pessoa ainda não viu.
 */
export async function sincronizarConquistas(): Promise<UnlockedBadge[]> {
  const session = await getSession();
  if (!session) return [];
  const { earned } = await syncAchievements(session);
  const out: UnlockedBadge[] = [];
  for (const code of earned) {
    const b = BADGE_BY_CODE[code];
    if (b) out.push({ code: b.code, emoji: b.emoji, title: b.title, desc: b.desc });
  }
  return out;
}

// =============================================================================
// VOLUNTÁRIO: feedback do culto (privado — só a própria pessoa vê)
// =============================================================================
export async function enviarFeedback(
  eventId: string,
  rating: number,
  comment: string,
): Promise<ActionResult & { unlocked?: UnlockedBadge[] }> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (rating < 1 || rating > 5) return fail("Escolha de 1 a 5 estrelas.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_feedback")
    .upsert(
      { profile_id: session.userId, event_id: eventId, rating, comment: comment.trim() || null },
      { onConflict: "profile_id,event_id" },
    );
  if (error) return fail(error.message);
  await logActivity({ profileId: session.userId, actorId: session.userId, kind: "feedback", eventId, meta: { rating } });
  const unlocked = await notificarConquistas(session);
  revalidatePath("/inicio");
  return { ok: true, unlocked };
}

// =============================================================================
// LÍDER / ADMIN: lembrar quem ainda não confirmou
// =============================================================================
/**
 * Cutuca (sino + e-mail) todos os escalados de um evento que ainda estão como
 * "convidado" (não responderam), restrito às equipes que o solicitante gerencia.
 */
export async function lembrarPendentes(eventId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("assignments")
    .select("profile_id, team_id, status")
    .eq("event_id", eventId)
    .eq("status", "convidado");
  if (error) return fail(error.message);

  const targets = (rows ?? [])
    .filter((r) => r.profile_id && canManageTeam(session, r.team_id))
    .map((r) => r.profile_id as string);
  const ids = Array.from(new Set(targets));
  if (ids.length === 0) return fail("Ninguém pra lembrar — todo mundo já respondeu.");

  const { data: evInfo } = await supabase
    .from("events")
    .select("title, starts_at")
    .eq("id", eventId)
    .maybeSingle();
  const titulo = evInfo?.title ?? "um culto";
  const quando = fmtEventWhen(evInfo?.starts_at);

  await notifyMany(ids, {
    kind: "lembrete",
    title: "Confirme sua escala",
    body: `Você ainda não confirmou presença em ${titulo} (${quando}).`,
    link: `/escalas/${eventId}`,
    eventId,
  });

  try {
    const { data: profs } = await supabase.from("profiles").select("email").in("id", ids);
    const emails = (profs ?? []).map((p) => p.email).filter((e): e is string => !!e);
    if (emails.length > 0) {
      const em = lembreteEmail({ evento: titulo, quando, href: `${siteUrl()}/escalas/${eventId}` });
      await sendEmail({ to: emails, subject: em.subject, html: em.html });
    }
  } catch {
    /* best-effort — falha de e-mail não derruba o lembrete */
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

  await logActivity({
    profileId: input.profileId,
    actorId: session.userId,
    kind: "escalado",
    eventId: input.eventId,
    teamId: input.teamId,
  });

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
  let callAt: string | null = null;
  try {
    startsAt = saoPauloToIso(input.date, input.time || "18:00");
    if (input.callTime) callAt = saoPauloToIso(input.date, input.callTime);
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
      call_time: callAt,
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
// PEDIDO DE EVENTO: líder sugere -> admin aprova (cria o evento)
// =============================================================================
export async function solicitarEvento(input: {
  title: string;
  date: string;
  time: string;
  location?: string;
  note?: string;
  teamIds?: string[];
}): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (session.role !== "admin" && session.role !== "leader") return fail("Só líderes podem sugerir eventos.");
  if (!session.profile.church_id) return fail("Sua conta não está ligada a uma igreja.");
  const title = input.title.trim();
  if (title.length < 2) return fail("Dê um título ao evento.");

  let desiredAt: string;
  try {
    desiredAt = saoPauloToIso(input.date, input.time || "18:00");
  } catch {
    return fail("Data ou horário inválidos.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("event_requests").insert({
    church_id: session.profile.church_id,
    title,
    desired_at: desiredAt,
    location: input.location?.trim() || null,
    note: input.note?.trim() || null,
    team_ids: (input.teamIds ?? []).filter(Boolean),
    requested_by: session.userId,
  });
  if (error) return fail(error.message);

  const { data: admins } = await supabase
    .from("profiles")
    .select("id")
    .eq("church_id", session.profile.church_id)
    .eq("system_role", "admin");
  await notifyMany(
    (admins ?? []).map((a) => a.id),
    {
      kind: "evento_solicitado",
      title: "Novo pedido de evento",
      body: `${session.profile.full_name || "Um líder"} sugeriu: ${title} (${fmtEventWhen(desiredAt)}).`,
      link: "/calendario",
    },
  );

  revalidatePath("/calendario");
  return ok;
}

export async function resolverEventoSolicitado(
  id: string,
  aprovar: boolean,
  note: string,
): Promise<ActionResult & { eventId?: string }> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (session.role !== "admin") return fail("Só o administrador resolve pedidos de evento.");
  const supabase = await createClient();

  const { data: req } = await supabase
    .from("event_requests")
    .select("id, title, desired_at, location, note, team_ids, requested_by, church_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!req) return fail("Pedido não encontrado.");
  if (req.status !== "pendente") return fail("Esse pedido já foi resolvido.");

  let createdEventId: string | null = null;
  if (aprovar) {
    const { data: ev, error } = await supabase
      .from("events")
      .insert({
        church_id: req.church_id,
        title: req.title,
        starts_at: req.desired_at ?? new Date().toISOString(),
        location: req.location,
        notes: req.note,
        created_by: session.userId,
      })
      .select("id")
      .single();
    if (error || !ev) return fail(error?.message || "Não consegui criar o evento.");
    createdEventId = ev.id;

    // Semeia as posições das equipes pedidas (sugestão needed=1); o líder ajusta depois.
    const teamIds = ((req.team_ids ?? []) as string[]).filter(Boolean);
    if (teamIds.length > 0) {
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
      if (rows.length > 0) await supabase.from("event_requirements").insert(rows);
    }
  }

  const nota = note.trim();
  const { error: upErr } = await supabase
    .from("event_requests")
    .update({
      status: aprovar ? "aprovado" : "recusado",
      resolved_by: session.userId,
      resolved_event_id: createdEventId,
    })
    .eq("id", id);
  if (upErr) return fail(upErr.message);

  await notify({
    recipientId: req.requested_by,
    kind: "evento_resolvido",
    title: aprovar ? "Evento aprovado! ✅" : "Sobre seu pedido de evento",
    body: aprovar
      ? `"${req.title}" entrou no calendário.${nota ? ` ${nota}` : ""}`
      : `"${req.title}" não foi aprovado agora.${nota ? ` ${nota}` : ""}`,
    link: aprovar && createdEventId ? `/escalas/${createdEventId}` : "/calendario",
  });

  revalidatePath("/calendario");
  revalidatePath("/escalas");
  revalidatePath("/inicio");
  return { ok: true, eventId: createdEventId ?? undefined };
}

/** Admin define/limpa o call time (chegada da equipe) de um evento. */
export async function definirCallTime(eventId: string, date: string, time: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (session.role !== "admin") return fail("Só o administrador define o horário de chegada.");
  let callAt: string | null = null;
  if (time.trim()) {
    try {
      callAt = saoPauloToIso(date, time);
    } catch {
      return fail("Horário inválido.");
    }
  }
  const supabase = await createClient();
  const { error } = await supabase.from("events").update({ call_time: callAt }).eq("id", eventId);
  if (error) return fail(error.message);
  revalidatePath(`/escalas/${eventId}`);
  revalidatePath("/inicio");
  return ok;
}

/** Admin define a localização da igreja (pro selo de check-in por GPS). */
export async function definirLocalIgreja(
  lat: number | null,
  lng: number | null,
  radiusM: number,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (session.role !== "admin") return fail("Só o administrador define o local da igreja.");
  if (!session.profile.church_id) return fail("Sua conta não está ligada a uma igreja.");
  const radius = Math.max(50, Math.min(2000, Math.round(radiusM || 200)));
  const supabase = await createClient();
  const { error } = await supabase
    .from("churches")
    .update({ latitude: lat, longitude: lng, checkin_radius_m: radius })
    .eq("id", session.profile.church_id);
  if (error) return fail(error.message);
  revalidatePath("/equipes");
  return ok;
}

/** Admin arquiva/desarquiva um evento (some das listas, mas mantém o histórico). */
export async function arquivarEvento(eventId: string, arquivar: boolean): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (session.role !== "admin") return fail("Só o administrador arquiva eventos.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({ archived_at: arquivar ? new Date().toISOString() : null })
    .eq("id", eventId);
  if (error) return fail(error.message);
  revalidatePath("/escalas");
  revalidatePath("/calendario");
  revalidatePath("/inicio");
  return ok;
}

/** Admin exclui o evento de vez (assignments/requisitos/feedback caem em cascata). */
export async function excluirEvento(eventId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (session.role !== "admin") return fail("Só o administrador exclui eventos.");
  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) return fail(error.message);
  revalidatePath("/escalas");
  revalidatePath("/calendario");
  revalidatePath("/inicio");
  return ok;
}

/** Busca endereço → coordenadas (geocoding grátis via OpenStreetMap/Nominatim). */
export async function buscarEndereco(query: string): Promise<{ label: string; lat: number; lng: number }[]> {
  const session = await getSession();
  if (!session) return [];
  const q = query.trim();
  if (q.length < 3) return [];
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=pt-BR&countrycodes=br&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "SirvoApp/1.0 (escalas de igreja)", Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { display_name: string; lat: string; lon: string }[];
    return data
      .map((d) => ({ label: d.display_name, lat: Number(d.lat), lng: Number(d.lon) }))
      .filter((d) => !Number.isNaN(d.lat) && !Number.isNaN(d.lng));
  } catch {
    return [];
  }
}

/** Admin define/limpa a localização de um evento (override do local da igreja). */
export async function definirLocalEvento(
  eventId: string,
  lat: number | null,
  lng: number | null,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (session.role !== "admin") return fail("Só o administrador define o local do evento.");
  const supabase = await createClient();
  const { error } = await supabase.from("events").update({ latitude: lat, longitude: lng }).eq("id", eventId);
  if (error) return fail(error.message);
  revalidatePath(`/escalas/${eventId}`);
  return ok;
}

// =============================================================================
// CRONOGRAMA (ordem do culto) — admin, responsável do culto ou líder de equipe do evento
// =============================================================================
async function podeEditarCronograma(session: Session, eventId: string): Promise<boolean> {
  if (session.role === "admin") return true;
  const supabase = await createClient();
  const { data: ev } = await supabase.from("events").select("responsible_id").eq("id", eventId).maybeSingle();
  if (ev?.responsible_id === session.userId) return true;
  const leadIds = session.profile.teams.filter((t) => t.role === "leader").map((t) => t.id);
  if (leadIds.length === 0) return false;
  const { data: reqs } = await supabase
    .from("event_requirements")
    .select("team_id")
    .eq("event_id", eventId)
    .in("team_id", leadIds)
    .limit(1);
  return (reqs ?? []).length > 0;
}

type BlocoInput = {
  title: string;
  kind: string;
  color?: string;
  durationMin: number;
  responsible?: string;
  note?: string;
  link?: string;
};

export async function adicionarBlocoCronograma(eventId: string, input: BlocoInput): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (!(await podeEditarCronograma(session, eventId))) return fail("Sem permissão pra editar o cronograma.");
  const title = input.title.trim();
  if (!title) return fail("Dê um nome ao bloco.");
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("event_rundown")
    .select("sort_order")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("event_rundown").insert({
    event_id: eventId,
    sort_order: (last?.sort_order ?? -1) + 1,
    title,
    kind: input.kind || "Outro",
    color: input.color || null,
    duration_min: Math.max(0, Math.round(input.durationMin || 0)),
    responsible: input.responsible?.trim() || null,
    note: input.note?.trim() || null,
    link: input.link?.trim() || null,
  });
  if (error) return fail(error.message);
  revalidatePath(`/escalas/${eventId}`);
  revalidatePath("/cronograma");
  return ok;
}

export async function atualizarBlocoCronograma(id: string, eventId: string, input: BlocoInput): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (!(await podeEditarCronograma(session, eventId))) return fail("Sem permissão.");
  const title = input.title.trim();
  if (!title) return fail("Dê um nome ao bloco.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_rundown")
    .update({
      title,
      kind: input.kind || "Outro",
      color: input.color || null,
      duration_min: Math.max(0, Math.round(input.durationMin || 0)),
      responsible: input.responsible?.trim() || null,
      note: input.note?.trim() || null,
      link: input.link?.trim() || null,
    })
    .eq("id", id);
  if (error) return fail(error.message);
  revalidatePath(`/escalas/${eventId}`);
  revalidatePath("/cronograma");
  return ok;
}

export async function removerBlocoCronograma(id: string, eventId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (!(await podeEditarCronograma(session, eventId))) return fail("Sem permissão.");
  const supabase = await createClient();
  const { error } = await supabase.from("event_rundown").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidatePath(`/escalas/${eventId}`);
  revalidatePath("/cronograma");
  return ok;
}

export async function reordenarCronograma(eventId: string, orderedIds: string[]): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (!(await podeEditarCronograma(session, eventId))) return fail("Sem permissão.");
  const supabase = await createClient();
  await Promise.all(
    orderedIds.map((id, i) =>
      supabase.from("event_rundown").update({ sort_order: i }).eq("id", id).eq("event_id", eventId),
    ),
  );
  revalidatePath(`/escalas/${eventId}`);
  revalidatePath("/cronograma");
  return ok;
}

/** Ajusta só a duração de um bloco (usado pelo arrastar-a-borda no grid). */
export async function ajustarDuracaoBloco(id: string, eventId: string, durationMin: number): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (!(await podeEditarCronograma(session, eventId))) return fail("Sem permissão.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_rundown")
    .update({ duration_min: Math.max(0, Math.round(durationMin)) })
    .eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/cronograma");
  return ok;
}

// --- Modo ao vivo do cronograma -------------------------------------------

/** Marca o START real do culto (âncora que desloca todos os horários). */
export async function iniciarCronograma(eventId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (!(await podeEditarCronograma(session, eventId))) return fail("Sem permissão.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({ rundown_started_at: new Date().toISOString() })
    .eq("id", eventId);
  if (error) return fail(error.message);
  revalidatePath("/cronograma");
  return ok;
}

/** Zera o modo ao vivo (limpa o start e todos os ticks de "feito"). */
export async function reiniciarCronograma(eventId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (!(await podeEditarCronograma(session, eventId))) return fail("Sem permissão.");
  const supabase = await createClient();
  await supabase.from("events").update({ rundown_started_at: null }).eq("id", eventId);
  await supabase.from("event_rundown").update({ done_at: null }).eq("event_id", eventId);
  revalidatePath("/cronograma");
  return ok;
}

/** Marca/desmarca um bloco como feito (carimba a hora real de término). */
export async function marcarBlocoFeito(id: string, eventId: string, done: boolean): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (!(await podeEditarCronograma(session, eventId))) return fail("Sem permissão.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_rundown")
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/cronograma");
  return ok;
}

// --- Tipos de bloco (por igreja) ------------------------------------------

export async function adicionarTipoBloco(label: string, color: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const canManage = session.role === "admin" || session.profile.teams.some((t) => t.role === "leader");
  if (!canManage) return fail("Só admin ou líderes gerenciam os tipos.");
  if (!session.profile.church_id) return fail("Sua conta não está ligada a uma igreja.");
  const l = label.trim();
  if (!l) return fail("Dê um nome ao tipo.");
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("rundown_kinds")
    .select("sort_order")
    .eq("church_id", session.profile.church_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("rundown_kinds").insert({
    church_id: session.profile.church_id,
    label: l,
    color: color || "#6b7280",
    sort_order: (last?.sort_order ?? -1) + 1,
  });
  if (error) return fail(error.message);
  revalidatePath("/cronograma");
  return ok;
}

export async function removerTipoBloco(id: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const canManage = session.role === "admin" || session.profile.teams.some((t) => t.role === "leader");
  if (!canManage) return fail("Sem permissão.");
  const supabase = await createClient();
  // Remover o tipo não afeta blocos já criados (eles guardam nome+cor próprios).
  const { error } = await supabase.from("rundown_kinds").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/cronograma");
  return ok;
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

/**
 * Líder responde a um pedido de servir com uma mensagem: aceita (a pessoa entra
 * na equipe) ou recusa. Grava quem/quando/o quê (histórico) e avisa o voluntário.
 */
export async function responderInteresse(
  id: string,
  teamId: string,
  aceitar: boolean,
  note: string,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (!canManageTeam(session, teamId)) return fail("Sem permissão.");
  const supabase = await createClient();

  const { data: it } = await supabase
    .from("service_interests")
    .select("profile_id, team:teams ( name )")
    .eq("id", id)
    .maybeSingle();
  if (!it) return fail("Pedido não encontrado.");

  const nota = note.trim();
  const { error } = await supabase
    .from("service_interests")
    .update({
      status: aceitar ? "atendido" : "arquivado",
      resolved_by: session.userId,
      resolved_note: nota || null,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return fail(error.message);

  // No aceite, a pessoa entra na equipe (se ainda não estiver).
  if (aceitar) {
    const { data: exists } = await supabase
      .from("memberships")
      .select("id")
      .eq("team_id", teamId)
      .eq("profile_id", it.profile_id)
      .maybeSingle();
    if (!exists) {
      await supabase.from("memberships").insert({ team_id: teamId, profile_id: it.profile_id, role: "volunteer" });
    }
  }

  const teamName = (it as { team?: { name: string } | null }).team?.name || "a equipe";
  await notify({
    recipientId: it.profile_id,
    kind: "interesse_resolvido",
    title: aceitar ? "Pedido aceito! 🎉" : "Sobre seu pedido de servir",
    body: aceitar
      ? `Você agora faz parte de ${teamName}.${nota ? ` ${nota}` : ""}`
      : `Sobre servir em ${teamName}: ${nota || "não deu certo agora, mas obrigado pelo interesse!"}`,
    link: "/inicio",
    teamId,
  });

  revalidatePath("/inicio");
  revalidatePath("/equipes");
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

  revalidatePath("/equipes");
  return ok;
}

export async function cancelarConvite(inviteId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session || session.role !== "admin") return fail("Sem permissão.");
  const supabase = await createClient();
  const { error } = await supabase.from("invites").update({ status: "cancelado" }).eq("id", inviteId);
  if (error) return fail(error.message);
  revalidatePath("/equipes");
  return ok;
}

/** Aprova um auto-cadastro (pré-login) transformando-o em convite. */
export async function aprovarJoinRequest(joinId: string, teams: InviteTeamInput[] = []): Promise<ActionResult> {
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
  let inviteId = existing?.id ?? null;
  if (!inviteId) {
    const { data: inv, error } = await supabase
      .from("invites")
      .insert({
        church_id: session.profile.church_id,
        email,
        full_name: jr.full_name,
        created_by: session.userId,
      })
      .select("id")
      .single();
    if (error || !inv) return fail(error?.message || "Não consegui criar o convite.");
    inviteId = inv.id;
  }

  const picked = teams.filter((t) => t.teamId);
  if (inviteId && picked.length > 0) {
    await supabase.from("invite_teams").insert(
      picked.map((t) => ({ invite_id: inviteId, team_id: t.teamId, role: t.role })),
    );
  }

  await supabase.from("join_requests").update({ status: "aprovado", resolved_by: session.userId }).eq("id", joinId);

  revalidatePath("/equipes");
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
  revalidatePath("/equipes");
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

  revalidatePath("/equipes");
  revalidatePath("/inicio");
  return ok;
}

// =============================================================================
// EQUIPES / POSIÇÕES (admin cria equipe; admin ou líder gerencia posições)
// =============================================================================
/** Admin renomeia uma equipe. */
export async function renomearEquipe(teamId: string, name: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (session.role !== "admin") return fail("Só o administrador renomeia equipes.");
  const value = name.trim();
  if (value.length < 2) return fail("Dê um nome à equipe.");
  const supabase = await createClient();
  const { error } = await supabase.from("teams").update({ name: value }).eq("id", teamId);
  if (error) return fail(error.message);
  revalidatePath("/equipes");
  revalidatePath("/inicio");
  revalidatePath("/escalas");
  return ok;
}

/** Admin vincula/limpa o link do grupo de WhatsApp da equipe (chat.whatsapp.com/...). */
export async function definirGrupoEquipe(teamId: string, link: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (session.role !== "admin") return fail("Só o administrador vincula o grupo da equipe.");
  const l = link.trim();
  if (l && !/^https:\/\/chat\.whatsapp\.com\/\S+/i.test(l))
    return fail("Cole o link de convite do grupo (começa com https://chat.whatsapp.com/).");
  const supabase = await createClient();
  const { error } = await supabase.from("teams").update({ whatsapp_group: l || null }).eq("id", teamId);
  if (error) return fail(error.message);
  revalidatePath("/equipes");
  revalidatePath("/escalas");
  return ok;
}

/** Admin arquiva/reativa uma equipe (some das listas; mantém histórico). */
export async function arquivarEquipe(teamId: string, arquivar: boolean): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (session.role !== "admin") return fail("Só o administrador arquiva equipes.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("teams")
    .update({ archived_at: arquivar ? new Date().toISOString() : null })
    .eq("id", teamId);
  if (error) return fail(error.message);
  revalidatePath("/equipes");
  revalidatePath("/inicio");
  revalidatePath("/escalas");
  return ok;
}

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
// ADMINISTRADOR DA IGREJA (promover / rebaixar) — só admin
// =============================================================================
export async function definirAdmin(profileId: string, makeAdmin: boolean): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (session.role !== "admin") return fail("Só o administrador pode mudar isso.");
  const supabase = await createClient();

  if (!makeAdmin) {
    if (profileId === session.userId) return fail("Você não pode remover seu próprio acesso de admin.");
    const churchId = session.profile.church_id;
    if (!churchId) return fail("Igreja não encontrada.");
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("church_id", churchId)
      .eq("system_role", "admin");
    if ((count ?? 0) <= 1) return fail("Precisa haver ao menos um administrador na igreja.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ system_role: makeAdmin ? "admin" : "member" })
    .eq("id", profileId);
  if (error) return fail(error.message);
  revalidatePath("/equipes");
  revalidatePath("/inicio");
  return ok;
}

/**
 * Exclui uma pessoa da igreja (recusar pendente OU remover ativo). Hard delete
 * do profile: memberships/interesses/avisos caem em cascata e as escalas dela
 * viram vaga aberta (FKs SET NULL). O login (auth.users) permanece, mas sem
 * profile a pessoa não acessa e não reaparece na fila.
 */
export async function excluirPessoa(profileId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (session.role !== "admin") return fail("Só o administrador pode excluir pessoas.");
  if (profileId === session.userId) return fail("Você não pode excluir a si mesmo.");
  const supabase = await createClient();

  const { data: target } = await supabase
    .from("profiles")
    .select("system_role")
    .eq("id", profileId)
    .maybeSingle();
  if (!target) return fail("Pessoa não encontrada.");

  if (target.system_role === "admin") {
    const churchId = session.profile.church_id;
    if (churchId) {
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("church_id", churchId)
        .eq("system_role", "admin");
      if ((count ?? 0) <= 1) return fail("Não dá pra excluir o último administrador.");
    }
  }

  const { error } = await supabase.from("profiles").delete().eq("id", profileId);
  if (error) return fail(error.message);
  revalidatePath("/equipes");
  revalidatePath("/inicio");
  return ok;
}

// =============================================================================
// DETALHE DO EVENTO PRO MODAL (líder/admin edita a escala sem sair da home)
// =============================================================================
export type EventoModalData = {
  ok: boolean;
  title?: string;
  startsAt?: string;
  canCheckin?: boolean;
  teams?: DetailTeam[];
  error?: string;
};

export async function carregarEventoParaModal(eventId: string): Promise<EventoModalData> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sessão expirada." };
  const ev = await getEventDetail(session, eventId);
  if (!ev) return { ok: false, error: "Evento não encontrado." };
  const canCheckin = churchDateISO(ev.starts_at) <= churchDateISO(new Date().toISOString());
  return {
    ok: true,
    title: ev.title,
    startsAt: ev.starts_at,
    canCheckin,
    teams: ev.teams.filter((t) => t.canManage),
  };
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
  const fields = {
    title: nome,
    start_time: input.time || "18:00",
    call_time: input.callTime || null,
    location: input.location?.trim() || null,
  };

  let seriesId = input.id;
  if (seriesId) {
    // Editar/"salvar em cima" de um modelo existente.
    const { error } = await supabase.from("event_series").update(fields).eq("id", seriesId);
    if (error) return fail(error.message);
    const { error: delErr } = await supabase.from("series_teams").delete().eq("series_id", seriesId);
    if (delErr) return fail(delErr.message);
  } else {
    const { data: series, error } = await supabase
      .from("event_series")
      .insert({ church_id: session.profile.church_id, ...fields })
      .select("id")
      .single();
    if (error || !series) return fail(error?.message || "Não consegui criar o modelo.");
    seriesId = series.id;
  }

  const { error: stErr } = await supabase
    .from("series_teams")
    .insert(teamIds.map((teamId) => ({ series_id: seriesId!, team_id: teamId })));
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
export async function fazerCheckin(
  assignmentId: string,
  teamId: string,
  eventId: string,
  lat?: number | null,
  lng?: number | null,
  force?: boolean,
): Promise<ActionResult & { unlocked?: UnlockedBadge[]; code?: string }> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const supabase = await createClient();
  const { data: a } = await supabase.from("assignments").select("profile_id").eq("id", assignmentId).maybeSingle();
  const isSelf = a?.profile_id === session.userId;
  if (!isSelf && !canManageTeam(session, teamId)) return fail("Sem permissão.");

  // Selo de local: usa a coordenada do EVENTO (ex.: retiro) ou, se não houver, a da igreja.
  let atLocation: boolean | null = null;
  if (typeof lat === "number" && typeof lng === "number") {
    const { data: evLoc } = await supabase
      .from("events")
      .select("latitude, longitude")
      .eq("id", eventId)
      .maybeSingle();
    let locLat: number | null = evLoc?.latitude ?? null;
    let locLng: number | null = evLoc?.longitude ?? null;
    let radius = 200;
    if (session.profile.church_id) {
      const { data: ch } = await supabase
        .from("churches")
        .select("latitude, longitude, checkin_radius_m")
        .eq("id", session.profile.church_id)
        .maybeSingle();
      if (ch?.checkin_radius_m) radius = ch.checkin_radius_m;
      if (locLat == null && ch?.latitude != null && ch?.longitude != null) {
        locLat = ch.latitude;
        locLng = ch.longitude;
      }
    }
    if (locLat != null && locLng != null) {
      atLocation = distanceM(lat, lng, locLat, locLng) <= radius;
      // Fora do raio: não grava ainda — o cliente pergunta "confirmar mesmo assim?".
      if (atLocation === false && !force) {
        return { ok: false, error: "Você não está no local do evento.", code: "outside" };
      }
    }
  }

  const { error } = await supabase
    .from("checkins")
    .insert({ assignment_id: assignmentId, checked_by: session.userId, at_location: atLocation });
  if (error && !error.message.includes("duplicate")) return fail(error.message);
  await logActivity({ profileId: a?.profile_id ?? session.userId, actorId: session.userId, kind: "checkin", eventId, teamId });
  // Conquistas do próprio (quando o líder marca por outro, a pessoa desbloqueia ao abrir o app).
  const unlocked = isSelf ? await notificarConquistas(session) : [];
  revalidatePath(`/escalas/${eventId}`);
  return { ok: true, unlocked };
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

  await logActivity({
    profileId: session.userId,
    actorId: session.userId,
    kind: "pediu_troca",
    eventId: a.event_id,
    teamId: a.team_id,
    meta: { motivo, suggested: suggestedProfileId },
  });

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

  await logActivity({
    profileId: swap.requested_by,
    actorId: session.userId,
    kind: "resolveu_troca",
    eventId,
    teamId: a.team_id,
    meta: { aprovar, substituto: swap.suggested_profile_id },
  });

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
