"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession, canManageTeam, leadTeamIds, type Session } from "@/lib/auth";
import {
  getEligibleMembers,
  getEventDetail,
  getChurchLocation,
  listChurchProfiles,
  listTeams,
  syncAchievements,
  getEventReviewData,
  getPersonObservations,
  getEventRundown,
  type EligibleMember,
  type DetailTeam,
  type EventReviewData,
  type PersonObservation,
  type RundownItem,
} from "@/lib/data";
import { BADGE_BY_CODE, type UnlockedBadge } from "@/lib/achievements";
import { nextCategoryColor } from "@/lib/palette";
import { TOPIC_BY_ID, type TopicId, type TopicChannel } from "@/lib/notification-topics";
import { logActivity } from "@/lib/activity";
import { notify, notifyMany, teamLeaderIds, avisoPrefs, quemAceitaEmail } from "@/lib/notify";
import { comVia, registrarEntrega } from "@/lib/delivery";
import { sendPushToSubs } from "@/lib/push";
import {
  sendEmail, conviteEmail, escaladoEmail, lembreteEmail, pedidoRecebidoEmail,
  siteUrl, linkDeEntrada, DIAS_LINK_ENTRADA,
} from "@/lib/email";
import { churchDateISO, fmtEventWhen } from "@/lib/format";
import type { DeliveryChannel } from "@/lib/supabase/database.types";
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

/** `ilike` trata % e _ como curinga: e-mail vindo de formulário público não pode
 *  virar padrão de busca. Escapa antes de comparar. */
const comoTexto = (e: string) => e.replace(/([\\%_])/g, "\\$1");

/**
 * `via` chega do `?via=` da URL — entrada de usuário. Um valor fora do enum
 * faria a RPC lançar e a CONFIRMAÇÃO falhar por causa de telemetria, que é
 * exatamente a inversão de prioridade a evitar: medir nunca pode custar a ação.
 * Na dúvida, joga a medição fora e confirma.
 */
const CANAIS: readonly DeliveryChannel[] = ["push", "whatsapp", "email", "in_app"];
const canalSeguro = (v?: DeliveryChannel | null): DeliveryChannel | undefined =>
  v && CANAIS.includes(v) ? v : undefined;

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
// =============================================================================
// ONBOARDING: pode mandar link de acesso pra esse e-mail?
// =============================================================================
/**
 * O botão "Receber link de acesso" usa `signInWithOtp`, e o default do Supabase é
 * CRIAR a conta de qualquer e-mail digitado. Resultado: quem nunca foi convidado
 * entrava pela janela e virava uma conta órfã — pendente, com `church_id` nulo,
 * presa em /aguardando e destravável só à mão em Equipes.
 *
 * Por que não resolvemos com `shouldCreateUser: false`: o convite NÃO cria conta
 * no auth. O e-mail de convite só diz "entre com este mesmo e-mail", e é o
 * primeiro login que cria a conta e casa com o convite (trigger handle_new_user).
 * Com a flag, todo convidado que usa magic link — justamente quem não tem Gmail —
 * ficaria impedido de entrar. Então a porta continua aberta pra criar conta; o
 * que mudou é que agora conferimos ANTES quem tem direito de bater nela.
 *
 * Roda com service-role de propósito: nada disso vira RPC pública, pra não criar
 * uma consulta de "esse e-mail existe?" acessível com a chave anônima.
 */
export type EmailParaLink = "ok" | "aguardando" | "nao_encontrado";

export async function verificarEmailParaLink(emailBruto: string): Promise<{ status: EmailParaLink }> {
  const email = emailBruto.trim().toLowerCase();
  if (!email.includes("@")) return { status: "nao_encontrado" };

  const admin = createAdminClient();
  // Sem service-role, libera: travar o login de todo mundo por causa de uma env
  // ausente seria pior que a conta órfã que estamos evitando (o líder destrava
  // em Equipes com um toque). Mas agora custa mais caro do que antes — neste
  // estado `nao_encontrado` nunca acontece, ou seja o formulário de pedido de
  // entrada fica INALCANÇÁVEL e todo mundo cai em /aguardando. Por isso o
  // alarme: em produção isto tem que aparecer no log da Vercel.
  if (!admin) {
    console.error("[onboarding] SUPABASE_SERVICE_ROLE_KEY ausente — a tela de entrar está liberando todo e-mail.");
    return { status: "ok" };
  }

  const [{ data: perfis }, { data: convites }, { data: pedidos }] = await Promise.all([
    admin.from("profiles").select("id").ilike("email", comoTexto(email)).limit(1),
    admin.from("invites").select("id").ilike("email", comoTexto(email)).eq("status", "pendente").limit(1),
    // `neq('recusado')` em vez de `eq('pendente')`: precisamos enxergar também os
    // APROVADOS (ver o bloco abaixo). Recusado nunca vale.
    admin.from("join_requests").select("status").ilike("email", comoTexto(email)).neq("status", "recusado"),
  ]);

  // Já tem conta (inclusive conta órfã antiga) ou tem convite esperando: entra.
  if ((perfis?.length ?? 0) > 0 || (convites?.length ?? 0) > 0) return { status: "ok" };

  // APROVADO É PERMISSÃO, NÃO FILA — e esta linha vem ANTES do "aguardando" de
  // propósito. Era aqui que morava o pior bug do onboarding: quem tinha um
  // pedido aprovado E um pedido antigo ainda pendente (o duplicado, que existia
  // porque a aprovação não dava acesso de verdade) ouvia "seu pedido está em
  // análise" — o app mandava esperar uma coisa que já tinha acontecido. Se o
  // convite tiver sido cancelado no meio, ela ainda cai em /aguardando, mas aí
  // como perfil na fila do líder, que é um toque, e não uma porta fechada.
  if (pedidos?.some((p) => p.status === "aprovado")) return { status: "ok" };

  // Pediu entrada e ninguém resolveu ainda: esperar é o certo, criar conta não.
  if ((pedidos?.length ?? 0) > 0) return { status: "aguardando" };
  return { status: "nao_encontrado" };
}

// ONBOARDING: solicitar entrada (auto-cadastro público — sem sessão)
// Passa pelo server (mesma origem) em vez de fetch direto do navegador ao
// Supabase — evita o "Load failed" do Safari e dá erro claro.
// =============================================================================
/**
 * Resultado próprio, e não o `ActionResult` genérico, porque a tela precisa dizer
 * três coisas diferentes: "recebemos", "já tínhamos recebido" e "seu acesso já
 * está liberado, procura o e-mail". Dizer "solicitação enviada!" pra quem já foi
 * aprovado é como o app mentiu pra Rayane.
 */
export type SolicitarEntradaResult =
  | { ok: true; estado: "novo" | "ja_pendente" | "ja_aprovado" }
  | { ok: false; error: string };

export async function solicitarEntrada(input: {
  fullName: string;
  email: string;
  phone: string;
  message: string;
  desiredTeamId?: string | null;
}): Promise<SolicitarEntradaResult> {
  const nome = input.fullName.trim();
  // Atenção: aqui NÃO dá pra usar o helper `fail()` — ele devolve `ActionResult`,
  // que não encaixa neste tipo (o ramo `{ok:true}` dele não tem `estado`).
  if (nome.length < 2) return { ok: false, error: "Informe seu nome completo." };
  const email = input.email.trim().toLowerCase();

  // PEDIR DUAS VEZES NÃO PODE VIRAR DOIS PEDIDOS.
  // A RPC `solicitar_entrada` (migration 0040, linha 52) insere sem conferir
  // nada, então a guarda mora aqui — de propósito, pra esta tarefa não precisar
  // encostar no banco de produção. O pedido sobrando não era só ruído na fila do
  // líder: um pedido 'pendente' esquecido fazia o login responder "seu pedido
  // está em análise" pra quem JÁ tinha sido aprovado no outro.
  // Precisa de service-role: a RLS `join_read` (0040) só responde pra admin e
  // líder, e quem está pedindo entrada não está logado.
  const admin = createAdminClient();
  if (admin && email.includes("@")) {
    const { data: jaTem } = await admin
      .from("join_requests")
      .select("status")
      .ilike("email", comoTexto(email))
      .neq("status", "recusado");
    if (jaTem?.some((j) => j.status === "aprovado")) return { ok: true, estado: "ja_aprovado" };
    if ((jaTem?.length ?? 0) > 0) return { ok: true, estado: "ja_pendente" };
  } else if (!admin) {
    console.error("[onboarding] sem service-role — guarda de pedido duplicado desligada.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("solicitar_entrada", {
    p_full_name: nome,
    p_email: input.email.trim(),
    p_phone: input.phone.trim(),
    p_message: input.message.trim(),
    p_desired_team_id: input.desiredTeamId || undefined,
  });
  if (error) return { ok: false, error: error.message };

  // Recibo por e-mail (best-effort, igual ao resto): a tela de confirmação some
  // quando ela fecha a aba, e sem nada na caixa de entrada o único jeito de
  // conferir se mandou é mandar de novo. Era o que faltava para fechar o ciclo.
  const recibo = pedidoRecebidoEmail({ nome });
  await sendEmail({ to: email, subject: recibo.subject, html: recibo.html });

  return { ok: true, estado: "novo" };
}

/** Lista pública de equipes (RLS normal exige is_active()/is_admin() — não serve
 * pra anônimo no /cadastro nem pra pendente sem igreja na tela de espera). */
export async function listarEquipesPublicas(): Promise<{ id: string; name: string; color: string; icon: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("listar_equipes_publicas");
  return data ?? [];
}

/** Perfil pendente (login espontâneo, sem convite) define a equipe que quer
 * servir — abre a porta pro líder daquela equipe aprovar. */
export async function definirEquipeDesejada(teamId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (session.profile.status !== "pendente") return fail("Isso já foi resolvido.");
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ desired_team_id: teamId }).eq("id", session.userId);
  if (error) return fail(error.message);
  await notifyMany(await teamLeaderIds(teamId), {
    kind: "cadastro_pendente",
    title: "Alguém quer entrar na sua equipe",
    body: `${session.profile.full_name || "Alguém"} pediu pra servir na sua equipe.`,
    link: "/equipes",
    teamId,
  });
  revalidatePath("/aguardando");
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
export async function atualizarTelefone(
  phone: string,
): Promise<ActionResult & { unlocked?: UnlockedBadge[] }> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const value = phone.trim();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ phone: value || null }).eq("id", session.userId);
  if (error) return fail(error.message);
  // pode ter sido o último campo que faltava pro "Perfil completo"
  const unlocked = value ? await notificarConquistas({ ...session, profile: { ...session.profile, phone: value } }) : [];
  revalidatePath("/perfil");
  revalidatePath("/equipes");
  return { ok: true, unlocked };
}

/**
 * Consentimento de receber avisos no WhatsApp (0052).
 *
 * Guarda QUANDO, não um sim/não: a Meta exige opt-in demonstrável antes do
 * primeiro template e a LGPD pede a data. Telefone cadastrado NÃO é permissão —
 * são duas coisas separadas de propósito, e é por isso que existe esta coluna
 * em vez de tratar "tem telefone" como "pode mandar".
 *
 * Passa pela política `profiles_update_self` (id = auth.uid()), sem RPC. As
 * duas direções entram no activity_log: a coluna sozinha só conta a última, e
 * "tirou o consentimento" é justamente o que precisa ser auditável.
 */
export async function definirOptInWhatsApp(on: boolean): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const digitos = (session.profile.phone ?? "").replace(/\D/g, "");
  if (on && digitos.length < 10) {
    return fail("Adicione seu telefone com DDD antes de liberar o WhatsApp.");
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ whatsapp_opt_in_at: on ? new Date().toISOString() : null })
    .eq("id", session.userId);
  if (error) return fail(error.message);
  await logActivity({
    profileId: session.userId,
    actorId: session.userId,
    kind: on ? "liberou_whatsapp" : "revogou_whatsapp",
  });
  revalidatePath("/perfil");
  return ok;
}

// Aniversário: a própria pessoa define o próprio (aceita vazio pra limpar).
export async function atualizarAniversario(
  birth: string,
): Promise<ActionResult & { unlocked?: UnlockedBadge[] }> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const value = birth.trim();
  if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fail("Data inválida.");
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ birth_date: value || null }).eq("id", session.userId);
  if (error) return fail(error.message);
  const unlocked = value
    ? await notificarConquistas({ ...session, profile: { ...session.profile, birth_date: value } })
    : [];
  revalidatePath("/perfil");
  revalidatePath("/equipes");
  revalidatePath("/inicio");
  return { ok: true, unlocked };
}

// =============================================================================
// PREFERÊNCIAS DE AVISO (WS2.2 — migration 0044)
// =============================================================================
/**
 * Liga/desliga um ASSUNTO num canal. O assunto é a embalagem: escreve a linha de
 * cada `notification_kind` que ele contém, preservando o outro canal. Upsert por
 * (profile_id, kind), que é a PK.
 */
export async function definirPreferenciaAviso(
  topicId: TopicId,
  channel: TopicChannel,
  value: boolean,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const topic = TOPIC_BY_ID[topicId];
  if (!topic) return fail("Assunto desconhecido.");
  if (!topic.channels.includes(channel)) return fail("Esse assunto não usa esse canal.");

  const supabase = await createClient();
  const { data: atuais } = await supabase
    .from("notification_prefs")
    .select("kind, push, email, in_app")
    .eq("profile_id", session.userId)
    .in("kind", topic.kinds);
  const byKind = new Map((atuais ?? []).map((r) => [r.kind as string, r]));

  const rows = topic.kinds.map((kind) => {
    const atual = byKind.get(kind);
    return {
      profile_id: session.userId,
      kind,
      push: channel === "push" ? value : (atual?.push ?? true),
      email: channel === "email" ? value : (atual?.email ?? true),
      in_app: atual?.in_app ?? true,
    };
  });
  const { error } = await supabase
    .from("notification_prefs")
    .upsert(rows, { onConflict: "profile_id,kind" });
  if (error) return fail(error.message);
  revalidatePath("/perfil");
  return ok;
}

// =============================================================================
// FOTO DE PERFIL (bucket `avatars`, migration 0043)
// =============================================================================
// O navegador já corta e comprime a imagem (avatar-upload.tsx) — aqui chega um
// JPEG pequeno. O caminho é avatars/<user_id>/<timestamp>.jpg: a pasta com o id
// é o que a RLS do storage checa, e o timestamp no nome mata o cache do CDN
// quando a pessoa troca a foto.
const AVATAR_MAX_BYTES = 1_500_000;
const AVATAR_BUCKET = "avatars";

/** Caminho dentro do bucket, se a URL for de um avatar NOSSO (ignora a do Google). */
function avatarPathFromUrl(url: string | null): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return decodeURIComponent(url.slice(i + marker.length).split("?")[0]) || null;
}

export async function atualizarFotoPerfil(
  form: FormData,
): Promise<ActionResult & { unlocked?: UnlockedBadge[] }> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const file = form.get("foto");
  if (!(file instanceof File) || file.size === 0) return fail("Escolha uma imagem.");
  if (file.size > AVATAR_MAX_BYTES) return fail("Imagem muito grande. Tente outra foto.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return fail("Formato não aceito. Use JPG, PNG ou WEBP.");
  }

  const supabase = await createClient();
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${session.userId}/${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (upErr) return fail(upErr.message);

  const { data: pub } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  const publicUrl = pub.publicUrl;

  const anterior = avatarPathFromUrl(session.profile.avatar_url);
  const { error } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", session.userId);
  if (error) {
    // não deixa arquivo órfão se o update falhou
    await supabase.storage.from(AVATAR_BUCKET).remove([path]);
    return fail(error.message);
  }
  // só depois de gravar a nova: se a limpeza falhar, ninguém perde a foto
  if (anterior && anterior !== path) await supabase.storage.from(AVATAR_BUCKET).remove([anterior]);

  const unlocked = await notificarConquistas(session);
  revalidatePath("/perfil");
  revalidatePath("/inicio");
  revalidatePath("/equipes");
  return { ok: true, unlocked };
}

export async function removerFotoPerfil(): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const supabase = await createClient();
  const atual = avatarPathFromUrl(session.profile.avatar_url);
  const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", session.userId);
  if (error) return fail(error.message);
  if (atual) await supabase.storage.from(AVATAR_BUCKET).remove([atual]);
  revalidatePath("/perfil");
  revalidatePath("/inicio");
  revalidatePath("/equipes");
  return ok;
}

/** Admin corrige dados de qualquer pessoa (ex.: convite feito com nome/e-mail errado). */
export async function atualizarPessoaAdmin(
  profileId: string,
  input: { fullName?: string; phone?: string; email?: string; birthdate?: string },
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (session.role !== "admin") return fail("Só o administrador edita dados de outras pessoas.");
  const patch: { full_name?: string; phone?: string | null; email?: string | null; birth_date?: string | null } = {};
  if (input.fullName !== undefined) {
    const v = input.fullName.trim();
    if (v.length < 2) return fail("Informe o nome.");
    patch.full_name = v;
  }
  if (input.phone !== undefined) patch.phone = input.phone.trim() || null;
  if (input.email !== undefined) patch.email = input.email.trim().toLowerCase() || null;
  if (input.birthdate !== undefined) {
    const b = input.birthdate.trim();
    if (b && !/^\d{4}-\d{2}-\d{2}$/.test(b)) return fail("Data de aniversário inválida.");
    patch.birth_date = b || null;
  }
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
/**
 * Carimba que a pessoa VIU a escalação (0052). Separa "o aviso não chegou" de
 * "chegou e ela demorou pra decidir" — a pergunta real dos silenciosos que já
 * têm push instalado. Idempotente no banco: o primeiro olhar é o que vale.
 *
 * Não devolve nada e não revalida: é medição, e não pode fazer a tela piscar.
 */
export async function marcarVistoEscalacao(assignmentId: string): Promise<void> {
  const session = await getSession();
  if (!session) return;
  try {
    const supabase = await createClient();
    await supabase.rpc("marcar_visto", { p_assignment: assignmentId });
  } catch {
    /* medir nunca atrapalha */
  }
}

export async function confirmarEscalacao(
  assignmentId: string,
  via?: DeliveryChannel | null,
): Promise<ActionResult & { unlocked?: UnlockedBadge[] }> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const supabase = await createClient();
  // `via` vai DENTRO da RPC (0052) e não num update aqui: a RLS de
  // `assignments` só dá UPDATE a admin/líder, então um update do próprio
  // voluntário casaria com zero linhas e a atribuição nasceria vazia sem erro.
  const { error } = await supabase.rpc("confirmar_escalacao", {
    p_assignment: assignmentId,
    p_via: canalSeguro(via),
  });
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

export async function recusarEscalacao(
  assignmentId: string,
  motivo: string,
  via?: DeliveryChannel | null,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const reason = motivo.trim();
  if (reason.length < 3) return fail("Conte rapidinho o motivo (ajuda o líder a remanejar).");
  const supabase = await createClient();
  const { error } = await supabase.rpc("recusar_escalacao", {
    p_assignment: assignmentId,
    p_motivo: reason,
    p_via: canalSeguro(via),
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
// AVALIAÇÃO DA EQUIPE (o líder avalia o culto + observa cada pessoa)
// =============================================================================
function podeAvaliarEquipe(session: Session): boolean {
  return session.role === "admin" || session.profile.teams.some((t) => t.role === "leader");
}

/** Nota 1-5 do culto (uma por líder/culto). */
export async function salvarAvaliacaoCulto(eventId: string, rating: number): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const churchId = session.profile.church_id;
  if (!churchId) return fail("Sessão sem igreja.");
  if (!podeAvaliarEquipe(session)) return fail("Só a liderança avalia a equipe.");
  if (rating < 1 || rating > 5) return fail("Escolha de 1 a 5 estrelas.");
  const supabase = await createClient();
  const { error } = await supabase.from("culto_avaliacoes").upsert(
    { church_id: churchId, event_id: eventId, author_id: session.userId, rating, updated_at: new Date().toISOString() },
    { onConflict: "event_id,author_id" },
  );
  if (error) return fail(error.message);
  revalidatePath("/inicio");
  revalidatePath("/cronograma");
  return ok;
}

/** Observação sobre uma pessoa que serviu (texto vazio apaga). */
export async function salvarObservacaoPessoa(
  eventId: string,
  subjectId: string,
  note: string,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const churchId = session.profile.church_id;
  if (!churchId) return fail("Sessão sem igreja.");
  if (!podeAvaliarEquipe(session)) return fail("Só a liderança avalia a equipe.");
  const supabase = await createClient();
  const texto = note.trim();
  if (!texto) {
    const { error } = await supabase
      .from("pessoa_observacoes")
      .delete()
      .eq("event_id", eventId)
      .eq("author_id", session.userId)
      .eq("subject_id", subjectId);
    if (error) return fail(error.message);
    return ok;
  }
  const { error } = await supabase.from("pessoa_observacoes").upsert(
    {
      church_id: churchId,
      event_id: eventId,
      author_id: session.userId,
      subject_id: subjectId,
      note: texto,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_id,author_id,subject_id" },
  );
  if (error) return fail(error.message);
  return ok;
}

/** Wrapper de leitura pro modal de revisão (client → server). */
export async function carregarRevisaoEvento(eventId: string): Promise<EventReviewData | null> {
  const session = await getSession();
  if (!session) return null;
  return getEventReviewData(session, eventId);
}

/** Observações da liderança sobre uma pessoa (a RLS filtra: autor ou admin). */
export async function carregarObservacoesPessoa(subjectId: string): Promise<PersonObservation[]> {
  const session = await getSession();
  if (!session) return [];
  return getPersonObservations(subjectId);
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
    .select("id, profile_id, team_id, status")
    .eq("event_id", eventId)
    .eq("status", "convidado");
  if (error) return fail(error.message);

  // Quem já pediu troca NÃO é cobrado: a pessoa avisou que não pode e a bola
  // está com o líder. Cobrar aqui é pedir que ela responda algo que já respondeu.
  const { data: comTroca } = await supabase
    .from("swap_requests")
    .select("assignment_id")
    .eq("status", "pendente");
  const bloqueados = new Set((comTroca ?? []).map((t) => t.assignment_id));

  const targets = (rows ?? [])
    .filter((r) => r.profile_id && canManageTeam(session, r.team_id) && !bloqueados.has(r.id))
    .map((r) => r.profile_id as string);
  const ids = Array.from(new Set(targets));
  if (ids.length === 0) return fail("Ninguém pra lembrar — todo mundo já respondeu ou pediu troca.");

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
    const querem = await quemAceitaEmail(ids, "lembrete");
    const { data: profs } = await supabase.from("profiles").select("email").in("id", querem);
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

  // Outras escalações da pessoa neste MESMO evento (ignora recusadas).
  const { data: existing } = await supabase
    .from("assignments")
    .select("id, team_id, position_id, status")
    .eq("event_id", input.eventId)
    .eq("profile_id", input.profileId)
    .neq("status", "recusado");

  if ((existing ?? []).some((a) => a.position_id === input.positionId)) {
    return fail("Essa pessoa já está escalada nesta posição.");
  }
  // Bloqueio real, sem exceção: pessoa já escalada em OUTRA equipe neste evento.
  if ((existing ?? []).some((a) => a.team_id !== input.teamId)) {
    return fail("Essa pessoa já está escalada em outra equipe neste evento.");
  }
  // Aviso: já escalada em outra posição desta MESMA equipe — líder confirma e segue.
  if (!override && (existing ?? []).some((a) => a.team_id === input.teamId)) {
    return {
      ok: false,
      error: "Essa pessoa já está escalada em outra função desta equipe hoje.",
      code: "already_in_team",
    };
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

  // O `.select("id")` é só pela telemetria (0052): é o que liga cada entrega à
  // escalação que ela cobra, e sem isso não dá pra medir "convite entregue por
  // este canal → respondido em quanto tempo". Se a leitura de volta falhar, o
  // aviso sai igual — só perde a amarração.
  const { data: criada, error } = await supabase
    .from("assignments")
    .insert({
      event_id: input.eventId,
      requirement_id: input.requirementId,
      team_id: input.teamId,
      position_id: input.positionId,
      profile_id: input.profileId,
      status: "convidado",
      assigned_by: session.userId,
    })
    .select("id")
    .maybeSingle();
  if (error) return fail(error.message);
  const assignmentId = criada?.id ?? null;

  await logActivity({
    profileId: input.profileId,
    actorId: session.userId,
    kind: "escalado",
    eventId: input.eventId,
    teamId: input.teamId,
  });

  const link = `/escalas/${input.eventId}`;
  await notify({
    recipientId: input.profileId,
    kind: "escalado",
    title: "Você foi escalado",
    body: "Toque para confirmar sua presença.",
    link,
    teamId: input.teamId,
    eventId: input.eventId,
    assignmentId,
  });

  // E-mail (best-effort) — canal garantido no iPhone, complementa o sino.
  const ctxEmail = {
    profileId: input.profileId,
    kind: "escalado" as const,
    eventId: input.eventId,
    teamId: input.teamId,
    assignmentId,
  };
  try {
    const [{ data: prof }, { data: evInfo }] = await Promise.all([
      supabase.from("profiles").select("email").eq("id", input.profileId).maybeSingle(),
      supabase.from("events").select("title, starts_at").eq("id", input.eventId).maybeSingle(),
    ]);
    if (!prof?.email) {
      await registrarEntrega({ ...ctxEmail, channel: "email", outcome: "sem_destino" });
    } else if (!(await avisoPrefs(input.profileId, "escalado")).email) {
      await registrarEntrega({ ...ctxEmail, channel: "email", outcome: "desligado" });
    } else {
      const esc = escaladoEmail({
        evento: evInfo?.title ?? "um evento",
        quando: fmtEventWhen(evInfo?.starts_at),
        href: `${siteUrl()}${comVia(link, "email")}`,
      });
      await sendEmail({ to: prof.email, subject: esc.subject, html: esc.html });
      await registrarEntrega({ ...ctxEmail, channel: "email", outcome: "enviado" });
    }
  } catch (e) {
    /* best-effort — falha de e-mail não derruba a escalação, mas deixa rastro */
    await registrarEntrega({
      ...ctxEmail,
      channel: "email",
      outcome: "falhou",
      detail: e instanceof Error ? e.message.slice(0, 200) : "erro desconhecido",
    });
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

/**
 * Define de uma vez quantas pessoas a posição precisa neste evento.
 * 0 = "não se aplica" (status not_applicable); ≥1 reativa (status needed).
 * Unifica o stepper e o "não se aplica" num controle só.
 */
export async function definirNecessario(
  requirementId: string,
  count: number,
  eventId: string,
  teamId: string,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (!canManageTeam(session, teamId)) return fail("Você não gerencia esta equipe.");
  const n = Math.max(0, Math.min(20, Math.trunc(count)));
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_requirements")
    .update({ needed_count: n, status: n === 0 ? "not_applicable" : "needed" })
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

  // Avisa os líderes das equipes convocadas: novo evento pra montar a escala.
  const { data: teamRows } = await supabase.from("teams").select("id, name").in("id", teamIds);
  const whenLabel = fmtEventWhen(startsAt);
  for (const t of teamRows ?? []) {
    await notifyMany(await teamLeaderIds(t.id), {
      kind: "evento_equipe",
      title: "Novo evento pra sua equipe",
      body: `${input.title.trim()} — ${whenLabel}. Monte a escala da ${t.name}.`,
      link: `/escalas/${ev.id}`,
      teamId: t.id,
      eventId: ev.id,
    });
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

  // Pedidos que geraram este evento (pra limpar o card fantasma de quem pediu e
  // avisar) — captura ANTES de apagar, porque o FK zera resolved_event_id no delete.
  const { data: reqs } = await supabase
    .from("event_requests")
    .select("id, requested_by")
    .eq("resolved_event_id", eventId);

  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) return fail(error.message);

  if (reqs && reqs.length > 0) {
    await supabase.from("event_requests").delete().in("id", reqs.map((r) => r.id));
    await notifyMany([...new Set(reqs.map((r) => r.requested_by).filter(Boolean))] as string[], {
      kind: "evento_resolvido",
      title: "Evento removido",
      body: "O evento que você sugeriu foi removido pela administração.",
      link: "/inicio",
    });
  }

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

/** Admin edita o culto de uma vez (data/hora/fim/chegada/local/GPS). */
export async function atualizarEvento(
  eventId: string,
  input: {
    date: string;
    time: string;
    endTime?: string;
    callTime?: string;
    location?: string;
    lat?: number | null;
    lng?: number | null;
  },
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (session.role !== "admin") return fail("Só o administrador edita o evento.");
  let startsAt: string;
  let endsAt: string | null = null;
  let callAt: string | null = null;
  try {
    startsAt = saoPauloToIso(input.date, input.time || "18:00");
    if (input.endTime) endsAt = saoPauloToIso(input.date, input.endTime);
    if (input.callTime) callAt = saoPauloToIso(input.date, input.callTime);
  } catch {
    return fail("Data ou horário inválidos.");
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({
      starts_at: startsAt,
      ends_at: endsAt,
      call_time: callAt,
      location: input.location?.trim() || null,
      latitude: input.lat ?? null,
      longitude: input.lng ?? null,
    })
    .eq("id", eventId);
  if (error) return fail(error.message);
  revalidatePath(`/escalas/${eventId}`);
  revalidatePath("/escalas");
  revalidatePath("/cronograma");
  return ok;
}

/** Admin define/limpa a localização de um evento (override do local da igreja). */
export async function definirLocalEvento(
  eventId: string,
  lat: number | null,
  lng: number | null,
  label?: string | null,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (session.role !== "admin") return fail("Só o administrador define o local do evento.");
  const patch: { latitude: number | null; longitude: number | null; location?: string | null } = {
    latitude: lat,
    longitude: lng,
  };
  if (label !== undefined) patch.location = label?.trim() || null;
  const supabase = await createClient();
  const { error } = await supabase.from("events").update(patch).eq("id", eventId);
  if (error) return fail(error.message);
  revalidatePath(`/escalas/${eventId}`);
  revalidatePath("/escalas");
  return ok;
}

// =============================================================================
// CRONOGRAMA (ordem do culto) — admin, responsável do culto ou líder de equipe do evento
// =============================================================================
// Aberto por enquanto: qualquer pessoa ativa pode montar/editar o cronograma
// (líder do louvor adiciona músicas, preletor põe versículos, etc.).
async function podeEditarCronograma(session: Session, _eventId: string): Promise<boolean> {
  // Estrutura do cronograma: só admin ou membro de equipe gestora (manages_rundown).
  // Bate com a RLS rundown_write (0029). Conteúdo (link/nota) tem caminho próprio.
  return session.role === "admin" || session.profile.teams.some((t) => t.manages_rundown);
}

/**
 * Voluntário escalado no evento adiciona link/observação a um bloco (não mexe na
 * estrutura).
 *
 * `versao` é o `contentUpdatedAt` que o cliente LEU. A RPC recusa se o conteúdo
 * mudou nesse meio-tempo (migration 0048) — antes disso, dois departamentos
 * anotando no mesmo bloco se sobrescreviam sem ninguém ficar sabendo.
 */
export async function contribuirNoBloco(
  blocoId: string,
  link: string,
  note: string,
  versao?: string | null,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("contribuir_no_bloco", {
    p_bloco: blocoId,
    p_link: link.trim(),
    p_note: note.trim(),
    p_versao: versao ?? null,
  });
  if (error) {
    const conflito = /ALTERADO_POR:(.+)$/.exec(error.message);
    if (conflito) return fail(mensagemDeConflito(conflito[1].trim()));
    return fail(error.message);
  }
  revalidatePath("/cronograma");
  return ok;
}

/** Uma frase só, e ela precisa dizer o que fazer — não só que deu errado. */
function mensagemDeConflito(nome: string): string {
  return `${nome} alterou este bloco enquanto você escrevia. Feche e abra de novo pra ver o que mudou — nada foi apagado.`;
}

/**
 * Marca/solta o aviso "estou editando este bloco" (migration 0048).
 *
 * É AVISO, não bloqueio: aparece na tela dos outros pelo realtime da 0047 e pode
 * ser assumido por quem confirmar. Trava dura no meio de um culto ao vivo seria
 * pior que o problema — bastaria o celular de quem abriu morrer pra ninguém mais
 * poder corrigir o roteiro.
 */
export async function marcarEditandoBloco(blocoId: string, on: boolean): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("marcar_editando_bloco", { p_bloco: blocoId, p_on: on });
  if (error) return fail(error.message);
  return ok;
}

/** Admin marca/desmarca uma equipe como gestora do cronograma (manages_rundown). */
export async function definirGestaoCronograma(teamId: string, on: boolean): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (session.role !== "admin") return fail("Só o administrador define isso.");
  const supabase = await createClient();
  const { error } = await supabase.from("teams").update({ manages_rundown: on }).eq("id", teamId);
  if (error) return fail(error.message);
  revalidatePath("/equipes");
  revalidatePath("/cronograma");
  return ok;
}

/** Admin/Produção define (ou limpa) o link da pasta de arquivos do evento. */
export async function definirPastaArquivos(eventId: string, url: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const pode = session.role === "admin" || session.profile.teams.some((t) => t.manages_rundown);
  if (!pode) return fail("Só admin ou a equipe de Produção define a pasta.");
  const link = url.trim();
  if (link && !/^https?:\/\//i.test(link)) return fail("Cole um link válido (começa com http).");
  const supabase = await createClient();
  const { error } = await supabase.rpc("definir_pasta_evento", { p_event: eventId, p_url: link });
  if (error) return fail(error.message);
  revalidatePath("/cronograma");
  return ok;
}

// =============================================================================
// PUSH (Web Push) — subscription do aparelho
// =============================================================================
export async function salvarPushSubscription(sub: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      { profile_id: session.userId, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
      { onConflict: "endpoint" },
    );
  if (error) return fail(error.message);
  return ok;
}

export async function removerPushSubscription(endpoint: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return ok;
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

/**
 * `versao` é o `contentUpdatedAt` que o cliente leu. O filtro `.eq` sobre ele faz
 * do UPDATE um compare-and-set atômico no banco: se outra pessoa salvou nesse
 * meio-tempo, nenhuma linha casa e nada é sobrescrito.
 */
export async function atualizarBlocoCronograma(
  id: string,
  eventId: string,
  input: BlocoInput,
  versao?: string | null,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (!(await podeEditarCronograma(session, eventId))) return fail("Sem permissão.");
  const title = input.title.trim();
  if (!title) return fail("Dê um nome ao bloco.");
  const supabase = await createClient();
  let q = supabase
    .from("event_rundown")
    .update({
      title,
      kind: input.kind || "Outro",
      color: input.color || null,
      duration_min: Math.max(0, Math.round(input.durationMin || 0)),
      responsible: input.responsible?.trim() || null,
      note: input.note?.trim() || null,
      link: input.link?.trim() || null,
      content_updated_at: new Date().toISOString(),
      content_updated_by: session.userId,
      // salvou = soltou: não deixa a própria marca de "editando" pra trás
      editing_by: null,
      editing_at: null,
    })
    .eq("id", id);
  // Sem `versao` (cliente antigo, aba aberta desde antes deste deploy) o
  // comportamento continua o de sempre — travar quem não sabe da versão seria
  // trocar uma perda silenciosa por um erro incompreensível.
  if (versao) q = q.eq("content_updated_at", versao);
  const { data: salvos, error } = await q.select("id");
  if (error) return fail(error.message);

  if (versao && (!salvos || salvos.length === 0)) {
    const { data: atual } = await supabase
      .from("event_rundown")
      .select("id, autor:profiles!event_rundown_content_updated_by_fkey ( nickname, full_name )")
      .eq("id", id)
      .maybeSingle();
    if (!atual) return fail("Este bloco foi removido do roteiro.");
    const a = (Array.isArray(atual.autor) ? atual.autor[0] : atual.autor) as
      | { nickname: string | null; full_name: string | null }
      | null
      | undefined;
    return fail(mensagemDeConflito(a?.nickname || a?.full_name || "Outra pessoa"));
  }

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

/**
 * As três abaixo mexem em `events`, e é aí que morava um bug silencioso: a RLS
 * de `events` só deixa ADMIN escrever, mas o app libera quem gerencia roteiro
 * (Produção). O UPDATE da líder casava com zero linhas — e zero linhas NÃO é
 * erro — então o app dizia "iniciado" e o banco não guardava nada. Desde a
 * migration 0049 elas passam por RPC `security definer`, que checa a permissão
 * por dentro e RECLAMA quando nega. Ver o cabeçalho da 0049.
 */

/** Marca o START real do culto (âncora que desloca todos os horários). */
export async function iniciarCronograma(eventId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (!(await podeEditarCronograma(session, eventId))) return fail("Sem permissão.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("iniciar_roteiro", { p_event: eventId });
  if (error) return fail(error.message);
  revalidatePath("/cronograma");
  revalidatePath("/control");
  return ok;
}

/** Zera o modo ao vivo (limpa o start, o encerramento e todos os ticks). */
export async function reiniciarCronograma(eventId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (!(await podeEditarCronograma(session, eventId))) return fail("Sem permissão.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("reiniciar_roteiro", { p_event: eventId });
  if (error) return fail(error.message);
  revalidatePath("/cronograma");
  revalidatePath("/control");
  return ok;
}

/** Encerra o culto agora — congela o relógio do modo ao vivo. */
export async function encerrarCronograma(eventId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (!(await podeEditarCronograma(session, eventId))) return fail("Sem permissão.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("encerrar_roteiro", { p_event: eventId });
  if (error) return fail(error.message);
  revalidatePath("/cronograma");
  revalidatePath("/control");
  return ok;
}

/**
 * Desfaz o encerramento (0051). Diferente de `reiniciarCronograma`: aqui o
 * start original e os tiques dos blocos ficam de pé — o culto volta exatamente
 * de onde estava. É o remédio pro encerramento acidental, e por isso precisa
 * estar a UM toque de distância de quem acabou de errar.
 */
export async function reabrirCronograma(eventId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (!(await podeEditarCronograma(session, eventId))) return fail("Sem permissão.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("reabrir_roteiro", { p_event: eventId });
  if (error) return fail(error.message);
  revalidatePath("/cronograma");
  revalidatePath("/control");
  return ok;
}

// --- Mensagem no monitor de palco (migration 0050) -------------------------

/**
 * A Produção falando com quem está no palco. O app grava, a ponte do
 * ProPresenter entrega (`stageDisplaySendMessage`). Uma mensagem viva por vez —
 * quem manda a nova apaga a anterior, dentro da própria RPC.
 */
export async function enviarStageMessage(eventId: string, texto: string, minutos: number): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (!(await podeEditarCronograma(session, eventId))) return fail("Sem permissão.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("enviar_stage_message", {
    p_event: eventId,
    p_texto: texto,
    p_minutos: Math.round(minutos),
  });
  if (error) return fail(error.message);
  revalidatePath("/cronograma");
  revalidatePath("/control");
  return ok;
}

export async function limparStageMessage(eventId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (!(await podeEditarCronograma(session, eventId))) return fail("Sem permissão.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("limpar_stage_message", { p_event: eventId });
  if (error) return fail(error.message);
  revalidatePath("/cronograma");
  revalidatePath("/control");
  return ok;
}

/** Atalhos são da IGREJA, não do aparelho — a régia e o celular usam os mesmos. */
export async function salvarAtalhoStage(label: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const pode = session.role === "admin" || session.profile.teams.some((t) => t.manages_rundown);
  if (!pode) return fail("Sem permissão.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("salvar_atalho_stage", { p_label: label });
  if (error) return fail(error.message);
  revalidatePath("/cronograma");
  revalidatePath("/control");
  return ok;
}

export async function removerAtalhoStage(id: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const pode = session.role === "admin" || session.profile.teams.some((t) => t.manages_rundown);
  if (!pode) return fail("Sem permissão.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("remover_atalho_stage", { p_id: id });
  if (error) return fail(error.message);
  revalidatePath("/cronograma");
  revalidatePath("/control");
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
  const { data: irmaos } = await supabase
    .from("rundown_kinds")
    .select("color, sort_order")
    .eq("church_id", session.profile.church_id)
    .order("sort_order", { ascending: false });
  const last = irmaos?.[0];
  const { error } = await supabase.from("rundown_kinds").insert({
    church_id: session.profile.church_id,
    label: l,
    // idem equipes: tipo novo sem cor pega o próximo tom livre da paleta
    color: color || nextCategoryColor((irmaos ?? []).map((k) => k.color ?? "")),
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

// --- Modelos de cronograma (presets de blocos) ----------------------------
type TemplateBloco = { kind: string; title: string; color: string | null; durationMin: number; note: string | null };

export async function salvarModeloCronograma(name: string, items: TemplateBloco[]): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const canManage = session.role === "admin" || session.profile.teams.some((t) => t.role === "leader");
  if (!canManage) return fail("Só admin ou líderes salvam modelos.");
  if (!session.profile.church_id) return fail("Sua conta não está ligada a uma igreja.");
  const nome = name.trim();
  if (!nome) return fail("Dê um nome ao modelo.");
  if (items.length === 0) return fail("O cronograma está vazio — nada pra salvar.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("rundown_templates")
    .insert({ church_id: session.profile.church_id, name: nome, items });
  if (error) return fail(error.message);
  revalidatePath("/cronograma");
  return ok;
}

export async function excluirModeloCronograma(id: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const canManage = session.role === "admin" || session.profile.teams.some((t) => t.role === "leader");
  if (!canManage) return fail("Sem permissão.");
  const supabase = await createClient();
  const { error } = await supabase.from("rundown_templates").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/cronograma");
  return ok;
}

/** Cola os blocos do modelo no cronograma do evento (acrescenta no fim). */
export async function aplicarModeloCronograma(eventId: string, templateId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (!(await podeEditarCronograma(session, eventId))) return fail("Sem permissão.");
  const supabase = await createClient();
  const { data: tpl } = await supabase.from("rundown_templates").select("items").eq("id", templateId).maybeSingle();
  const items = Array.isArray(tpl?.items) ? (tpl!.items as TemplateBloco[]) : [];
  if (items.length === 0) return fail("Modelo vazio.");
  const { data: last } = await supabase
    .from("event_rundown")
    .select("sort_order")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  let so = (last?.sort_order ?? -1) + 1;
  const rows = items.map((it) => ({
    event_id: eventId,
    sort_order: so++,
    title: it.title || it.kind || "Bloco",
    kind: it.kind || "Outro",
    color: it.color ?? null,
    duration_min: Math.max(0, Math.round(it.durationMin || 0)),
    note: it.note ?? null,
  }));
  const { error } = await supabase.from("event_rundown").insert(rows);
  if (error) return fail(error.message);
  revalidatePath("/cronograma");
  return ok;
}

/** Admin ou líder da equipe adiciona outra equipe a um evento já criado (copia as posições da equipe). */
export async function adicionarEquipeAoEvento(eventId: string, teamId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (!canManageTeam(session, teamId)) return fail("Você não pode adicionar essa equipe.");
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

/** Remove uma equipe de um evento: apaga as escalações e as posições dela nesse evento. */
export async function removerEquipeDoEvento(eventId: string, teamId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (!canManageTeam(session, teamId)) return fail("Você não pode remover essa equipe.");
  const supabase = await createClient();
  const { error: aErr } = await supabase
    .from("assignments")
    .delete()
    .eq("event_id", eventId)
    .eq("team_id", teamId);
  if (aErr) return fail(aErr.message);
  const { error: rErr } = await supabase
    .from("event_requirements")
    .delete()
    .eq("event_id", eventId)
    .eq("team_id", teamId);
  if (rErr) return fail(rErr.message);
  revalidatePath(`/escalas/${eventId}`);
  revalidatePath("/escalas");
  revalidatePath("/cronograma");
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

/**
 * Resposta do responsável ao "convite" de responsável: confirma que vai
 * acontecer (aceita) ou avisa que não vai poder — em ambos os casos manda a
 * mensagem (opcional) pros admins. Recusar não mexe no evento (RLS é do admin);
 * o admin reatribui.
 */
export async function responderResponsavel(eventId: string, aceita: boolean, note?: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const supabase = await createClient();
  if (aceita) {
    const { error } = await supabase.rpc("confirmar_evento", { p_event: eventId, p_confirmar: true });
    if (error) return fail(error.message);
  }
  if (session.profile.church_id) {
    const { data: admins } = await supabase
      .from("profiles")
      .select("id")
      .eq("church_id", session.profile.church_id)
      .eq("system_role", "admin");
    const quem = session.profile.full_name || "O responsável";
    const msg = note?.trim();
    await notifyMany((admins ?? []).map((a) => a.id), {
      kind: "evento_resolvido",
      title: aceita ? "Responsável confirmou o culto" : "Responsável não vai poder",
      body: `${quem} ${aceita ? "confirmou que vai acontecer" : "avisou que não vai poder ser responsável"}${msg ? `: “${msg}”` : "."}`,
      link: `/escalas/${eventId}`,
    });
  }
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
/** Prazo do link que vai no e-mail. Ver DIAS_LINK_ENTRADA em `email.ts`. */
function prazoDoConvite(): string {
  return new Date(Date.now() + DIAS_LINK_ENTRADA * 86_400_000).toISOString();
}

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
    .select("id, token")
    .eq("church_id", session.profile.church_id)
    // `comoTexto` aqui é cinto e suspensório: este e-mail vem de admin digitando
    // no próprio formulário, não de entrada anônima. Mas esta busca agora decide
    // QUAL token vai por e-mail, e uma comparação que aceita curinga nesse papel
    // é armadilha esperando mudança de contexto.
    .ilike("email", comoTexto(email))
    .eq("status", "pendente")
    .maybeSingle();
  // Convite pendente que já existe deixa de ser erro e passa a ser REENVIO: com
  // o link ganhando prazo (7 dias), recusar aqui deixaria o admin sem nenhuma
  // forma de renovar — só cancelar e recriar, que perde as equipes já marcadas.
  if (existing) {
    const { data: renovado } = await supabase
      .from("invites")
      .update({ expires_at: prazoDoConvite() })
      .eq("id", existing.id)
      .select("token")
      .single();
    if (renovado?.token) {
      const ehAdminR = input.systemRole === "admin";
      const reenvio = conviteEmail({
        nome: input.fullName.trim(),
        href: ehAdminR ? `${siteUrl()}/entrar` : linkDeEntrada(renovado.token),
        convidado: true,
        semLinkDireto: ehAdminR,
      });
      await sendEmail({ to: email, subject: reenvio.subject, html: reenvio.html });
    }
    revalidatePath("/equipes");
    return ok;
  }

  const { data: inv, error } = await supabase
    .from("invites")
    .insert({
      church_id: session.profile.church_id,
      email,
      full_name: input.fullName.trim(),
      phone: input.phone?.trim() || null,
      system_role: input.systemRole,
      created_by: session.userId,
      // A coluna existia desde a 0001 e nunca tinha sido preenchida. Nada no
      // banco lê ela (handle_new_user e reconciliar_onboarding olham só o
      // `status`), então preencher não muda comportamento nenhum — quem confere
      // é a rota /auth/entrar/[token], e só ela.
      expires_at: prazoDoConvite(),
    })
    .select("id, token")
    .single();
  if (error || !inv) return fail(error?.message || "Não consegui criar o convite.");

  const teams = (input.teams ?? []).filter((t) => t.teamId);
  if (teams.length > 0) {
    const { error: itErr } = await supabase.from("invite_teams").insert(
      teams.map((t) => ({ invite_id: inv.id, team_id: t.teamId, role: t.role })),
    );
    if (itErr) return fail(itErr.message);
  }

  // Convite de ADMIN não leva o link que entra: ele vale 7 dias e abre quantas
  // vezes quiser, então um e-mail encaminhado por engano viraria uma conta de
  // administrador da igreja. Pro admin, o e-mail continua levando à tela de
  // login — o que exige a caixa de entrada dele. Voluntário e líder ganham o
  // link direto, que é onde estava a dor.
  const ehAdmin = input.systemRole === "admin";
  const convite = conviteEmail({
    nome: input.fullName.trim(),
    href: ehAdmin ? `${siteUrl()}/entrar` : linkDeEntrada(inv.token),
    convidado: true,
    semLinkDireto: ehAdmin,
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

/** Aprova um auto-cadastro (pré-login) transformando-o em convite. Admin aprova
 * qualquer um; líder só o que pediu a equipe dele. */
export async function aprovarJoinRequest(joinId: string, teams: InviteTeamInput[] = []): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (!session.profile.church_id) return fail("Sua conta não está ligada a uma igreja.");
  const supabase = await createClient();

  const { data: jr } = await supabase
    .from("join_requests")
    .select("id, full_name, email, desired_team_id")
    .eq("id", joinId)
    .maybeSingle();
  if (!jr) return fail("Solicitação não encontrada.");
  if (session.role !== "admin" && !(jr.desired_team_id && canManageTeam(session, jr.desired_team_id))) {
    return fail("Você só pode aprovar pedidos da sua equipe.");
  }
  if (!jr.email) return fail("Essa solicitação não tem email — não dá pra casar no login.");

  const email = jr.email.trim().toLowerCase();
  const prazo = prazoDoConvite();
  // `.order().limit(1)` antes do `.maybeSingle()`: essa busca decide qual token
  // vai no e-mail, e `.maybeSingle()` sozinho DÁ ERRO se houver dois convites
  // pendentes do mesmo e-mail.
  const { data: existing } = await supabase
    .from("invites")
    .select("id, token")
    .ilike("email", comoTexto(email))
    .eq("status", "pendente")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let inviteId = existing?.id ?? null;
  let inviteToken = existing?.token ?? null;

  if (inviteId) {
    // Convite reaproveitado: renova o prazo, senão o link que estamos mandando
    // AGORA já nasceria vencido (ou com `expires_at` nulo de antes desta mudança).
    await supabase.from("invites").update({ expires_at: prazo }).eq("id", inviteId);
  } else {
    const { data: inv, error } = await supabase
      .from("invites")
      .insert({
        church_id: session.profile.church_id,
        email,
        full_name: jr.full_name,
        created_by: session.userId,
        expires_at: prazo,
      })
      .select("id, token")
      .single();
    if (error || !inv) return fail(error?.message || "Não consegui criar o convite.");
    inviteId = inv.id;
    inviteToken = inv.token;
  }

  const picked = teams.filter((t) => t.teamId && (session.role === "admin" || canManageTeam(session, t.teamId)));
  if (inviteId && picked.length > 0) {
    await supabase.from("invite_teams").insert(
      picked.map((t) => ({ invite_id: inviteId, team_id: t.teamId, role: t.role })),
    );
  }

  await supabase.from("join_requests").update({ status: "aprovado", resolved_by: session.userId }).eq("id", joinId);

  // UM e-mail, não dois. Antes daqui o botão levava a `/entrar`: a pessoa tinha
  // que digitar o e-mail de novo e esperar um SEGUNDO e-mail pra passar. A
  // Rayane foi aprovada 11/ago 21:19 e abriu OUTRO pedido de entrada às 22:03 —
  // 44 min depois de já estar aprovada — porque aprovar dava dever de casa, não
  // acesso. Agora o botão do e-mail já abre a sessão.
  //
  // O link só existe DEPOIS do convite: quem ativa o perfil no primeiro acesso é
  // o trigger handle_new_user, procurando um convite 'pendente' com este e-mail.
  if (!inviteToken) return fail("Não consegui gerar o link de acesso do convite.");
  const convite = conviteEmail({ nome: jr.full_name, href: linkDeEntrada(inviteToken) });
  await sendEmail({ to: email, subject: convite.subject, html: convite.html });

  revalidatePath("/equipes");
  revalidatePath("/inicio");
  return ok;
}

export async function recusarJoinRequest(joinId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sem permissão.");
  const supabase = await createClient();
  if (session.role !== "admin") {
    const { data: jr } = await supabase.from("join_requests").select("desired_team_id").eq("id", joinId).maybeSingle();
    if (!jr?.desired_team_id || !canManageTeam(session, jr.desired_team_id)) {
      return fail("Você só pode recusar pedidos da sua equipe.");
    }
  }
  const { error } = await supabase
    .from("join_requests")
    .update({ status: "recusado", resolved_by: session.userId })
    .eq("id", joinId);
  if (error) return fail(error.message);
  revalidatePath("/equipes");
  return ok;
}

/** Aprova alguém que logou sem convite (profile pendente) -> ativa + equipes.
 * Admin aprova qualquer um; líder só quem pediu a equipe dele. */
export async function aprovarProfilePendente(input: AprovarProfileInput): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (!session.profile.church_id) return fail("Sua conta não está ligada a uma igreja.");
  const supabase = await createClient();

  if (session.role !== "admin") {
    const { data: p } = await supabase.from("profiles").select("desired_team_id").eq("id", input.profileId).maybeSingle();
    if (!p?.desired_team_id || !canManageTeam(session, p.desired_team_id)) {
      return fail("Você só pode aprovar quem pediu a sua equipe.");
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ status: "ativo", church_id: session.profile.church_id })
    .eq("id", input.profileId);
  if (error) return fail(error.message);

  const teams = (input.teams ?? []).filter((t) => t.teamId && (session.role === "admin" || canManageTeam(session, t.teamId)));
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
  // Sem cor escolhida, a equipe nova ganha o próximo tom LIVRE da paleta — não um
  // default fixo (era assim que várias equipes terminavam com o mesmo pontinho).
  const { data: irmas } = await supabase
    .from("teams")
    .select("color, sort_order")
    .eq("church_id", session.profile.church_id)
    .order("sort_order", { ascending: false });
  const last = irmas?.[0];

  const { error } = await supabase.from("teams").insert({
    church_id: session.profile.church_id,
    name: nome,
    color: color?.trim() || nextCategoryColor((irmas ?? []).map((t) => t.color ?? "")),
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
  error?: string;
  role?: "admin" | "leader" | "volunteer";
  canCheckin?: boolean;
  title?: string;
  startsAt?: string;
  endsAt?: string | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  callTime?: string | null;
  archivedAt?: string | null;
  notes?: string | null;
  isResponsible?: boolean;
  responsibleName?: string | null;
  confirmedAt?: string | null;
  churchLat?: number | null;
  churchLng?: number | null;
  profiles?: { id: string; name: string; avatarUrl: string | null }[];
  teams?: DetailTeam[];
  availableTeams?: { id: string; name: string; color: string }[];
  rundown?: RundownItem[];
};

export async function carregarEventoParaModal(eventId: string): Promise<EventoModalData> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sessão expirada." };
  const ev = await getEventDetail(session, eventId);
  if (!ev) return { ok: false, error: "Evento não encontrado." };
  const canCheckin = churchDateISO(ev.starts_at) <= churchDateISO(new Date().toISOString());
  const isAdmin = session.role === "admin";
  const isLeader = session.role === "leader";
  const [churchLoc, profiles, allTeams, rundown] = await Promise.all([
    isAdmin ? getChurchLocation(session) : Promise.resolve(null),
    isAdmin ? listChurchProfiles() : Promise.resolve([]),
    isAdmin || isLeader ? listTeams() : Promise.resolve([]),
    getEventRundown(eventId),
  ]);
  const inEvent = new Set((ev.teams ?? []).map((t) => t.teamId));
  const leadIds = new Set(leadTeamIds(session.profile));
  const availableTeams = allTeams
    .filter((t) => !inEvent.has(t.id))
    .filter((t) => isAdmin || leadIds.has(t.id))
    .map((t) => ({ id: t.id, name: t.name, color: t.color }));
  return {
    ok: true,
    role: session.role,
    canCheckin,
    title: ev.title,
    startsAt: ev.starts_at,
    endsAt: ev.ends_at,
    location: ev.location,
    latitude: ev.latitude,
    longitude: ev.longitude,
    callTime: ev.callTime,
    archivedAt: ev.archivedAt,
    notes: ev.notes,
    isResponsible: ev.isResponsible,
    responsibleName: ev.responsibleName,
    confirmedAt: ev.confirmedAt,
    churchLat: churchLoc?.latitude ?? null,
    churchLng: churchLoc?.longitude ?? null,
    profiles,
    // Visão única: todas as equipes que o usuário enxerga (gerencia OU está escalado).
    teams: ev.teams,
    availableTeams,
    rundown,
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
  // Presença passa a valer como status 'presente' (entra no anel de cobertura da home/escala).
  // Não sobrescreve quem recusou.
  await supabase.from("assignments").update({ status: "presente" }).eq("id", assignmentId).neq("status", "recusado");
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
  // Desfazer presença volta o status pra 'confirmado' (a pessoa segue escalada).
  await supabase.from("assignments").update({ status: "confirmado" }).eq("id", assignmentId).eq("status", "presente");
  revalidatePath(`/escalas/${eventId}`);
  return ok;
}

// -----------------------------------------------------------------------------
// Mudar status de uma escalação pelo gestor (líder/admin) — sem GPS.
// Fluxo: convidado → confirmado → presente (e voltas). "presente" nunca pula
// a confirmação. Ao marcar presente grava a linha de checkins (sem localização).
// -----------------------------------------------------------------------------
export async function definirStatusEscala(
  assignmentId: string,
  teamId: string,
  eventId: string,
  novoStatus: "convidado" | "confirmado" | "presente",
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  if (!canManageTeam(session, teamId)) return fail("Sem permissão.");
  const supabase = await createClient();
  const { data: a } = await supabase
    .from("assignments")
    .select("profile_id, status")
    .eq("id", assignmentId)
    .maybeSingle();
  if (!a) return fail("Escalação não encontrada.");

  // Ninguém fica "presente" sem ter confirmado antes.
  if (novoStatus === "presente" && a.status !== "confirmado" && a.status !== "presente") {
    return fail("Confirme a pessoa antes de marcar presença.");
  }

  const { error } = await supabase.from("assignments").update({ status: novoStatus }).eq("id", assignmentId);
  if (error) return fail(error.message);

  // Presença ⇄ linha de checkins (o gestor marca sem localização).
  if (novoStatus === "presente") {
    await supabase
      .from("checkins")
      .upsert({ assignment_id: assignmentId, checked_by: session.userId, at_location: null }, { onConflict: "assignment_id" });
    await logActivity({ profileId: a.profile_id ?? session.userId, actorId: session.userId, kind: "checkin", eventId, teamId });
  } else {
    await supabase.from("checkins").delete().eq("assignment_id", assignmentId);
  }

  revalidatePath(`/escalas/${eventId}`);
  return ok;
}

// =============================================================================
// TROCA / SUBSTITUTO (swap_requests)
// =============================================================================
/**
 * Colegas de equipe que podem cobrir. Passando o `assignmentId`, marca quem já
 * RECUSOU cobrir essa mesma escala — sem isso a pessoa que recusou volta pra
 * lista limpa e acaba sendo sugerida de novo (foi o que aconteceu em 31/jul:
 * mesma dupla, mesmo culto, dois pedidos seguidos). Continua selecionável, é só
 * informação: gente muda de ideia, mas quem sugere merece saber.
 */
export async function listMembrosParaTroca(
  teamId: string,
  assignmentId?: string,
): Promise<{ profileId: string; name: string; avatarUrl: string | null; recusouAntes: boolean }[]> {
  const session = await getSession();
  if (!session) return [];
  const supabase = await createClient();
  const [{ data }, { data: recusas }] = await Promise.all([
    supabase
      .from("memberships")
      .select("profile:profiles ( id, full_name, avatar_url, status )")
      .eq("team_id", teamId),
    assignmentId
      ? supabase
          .from("swap_requests")
          .select("suggested_profile_id")
          .eq("assignment_id", assignmentId)
          .eq("status", "recusada")
      : Promise.resolve({ data: [] as { suggested_profile_id: string | null }[] }),
  ]);
  const recusou = new Set((recusas ?? []).map((r) => r.suggested_profile_id).filter(Boolean) as string[]);
  return ((data ?? []) as { profile: { id: string; full_name: string; avatar_url: string | null; status: string } | null }[])
    .filter((m) => m.profile && m.profile.status === "ativo" && m.profile.id !== session.userId)
    .map((m) => ({
      profileId: m.profile!.id,
      name: m.profile!.full_name || "Sem nome",
      avatarUrl: m.profile!.avatar_url,
      recusouAntes: recusou.has(m.profile!.id),
    }))
    // quem já recusou vai pro fim da lista
    .sort((a, b) =>
      a.recusouAntes !== b.recusouAntes
        ? a.recusouAntes
          ? 1
          : -1
        : a.name.localeCompare(b.name, "pt-BR"),
    );
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
    .update({
      status: aprovar ? "aprovada" : "recusada",
      resolved_by: session.userId,
      resolved_at: new Date().toISOString(),
    })
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

/**
 * O substituto sugerido aceita a indicação (falta só o líder aprovar).
 *
 * AVISA quem pediu e os líderes. Antes de 31/jul isto era silencioso: a resposta
 * do substituto não gerava aviso nem registro, e um caso real (Moisés→Pedro)
 * mostrou o estrago — o substituto recusou, ninguém soube, o pedido morreu no
 * silêncio e dois dias depois a mesma pessoa foi sugerida de novo.
 */
export async function aceitarSubstituicao(swapId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const supabase = await createClient();
  const { data: swap } = await supabase
    .from("swap_requests")
    .select(
      "id, suggested_profile_id, status, requested_by, assignment:assignments!swap_requests_assignment_id_fkey ( event_id, team_id )",
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

  const alvo = swap.assignment as { event_id: string; team_id: string | null } | null;
  const eventId = alvo?.event_id;
  const teamId = alvo?.team_id ?? null;
  const quem = session.profile.nickname || session.profile.full_name || "Alguém";
  const link = eventId ? `/escalas/${eventId}` : "/inicio";

  await logActivity({
    profileId: session.userId,
    actorId: session.userId,
    kind: "aceitou_substituicao",
    eventId: eventId ?? null,
    teamId,
    meta: { swapId, requestedBy: swap.requested_by },
  });
  await notify({
    recipientId: swap.requested_by,
    kind: "troca_resolvida",
    title: `${quem} topou cobrir!`,
    body: "Agora falta só o líder aprovar a troca.",
    link,
    teamId,
    eventId: eventId ?? null,
  });
  if (teamId) {
    await notifyMany(await teamLeaderIds(teamId), {
      kind: "troca_solicitada",
      title: "Troca pronta pra aprovar",
      body: `${quem} aceitou cobrir a vaga. Falta sua aprovação.`,
      link,
      teamId,
      eventId: eventId ?? null,
    });
  }

  revalidatePath("/inicio");
  if (eventId) revalidatePath(`/escalas/${eventId}`);
  return ok;
}

/**
 * O substituto sugerido recusa a indicação (o pedido morre).
 *
 * A recusa é a resposta mais importante de avisar: quem pediu volta a ser o
 * responsável pela vaga e precisa procurar outra pessoa. Sem este aviso (era o
 * caso até 31/jul), a escala fica "Aguardando X aceitar" pra sempre na tela do
 * líder, e ninguém descobre que a vaga voltou a estar em risco.
 */
export async function recusarSubstituicao(swapId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const supabase = await createClient();
  const { data: swap } = await supabase
    .from("swap_requests")
    .select(
      "id, suggested_profile_id, status, requested_by, assignment:assignments!swap_requests_assignment_id_fkey ( event_id, team_id )",
    )
    .eq("id", swapId)
    .maybeSingle();
  if (!swap) return fail("Pedido não encontrado.");
  if (swap.suggested_profile_id !== session.userId) return fail("Esse pedido não é pra você.");
  if (swap.status !== "pendente") return fail("Esse pedido já foi resolvido.");

  const { error } = await supabase
    .from("swap_requests")
    .update({ status: "recusada", resolved_by: session.userId, resolved_at: new Date().toISOString() })
    .eq("id", swapId);
  if (error) return fail(error.message);

  const alvo = swap.assignment as { event_id: string; team_id: string | null } | null;
  const eventId = alvo?.event_id;
  const teamId = alvo?.team_id ?? null;
  const quem = session.profile.nickname || session.profile.full_name || "A pessoa sugerida";
  const link = eventId ? `/escalas/${eventId}` : "/inicio";

  await logActivity({
    profileId: session.userId,
    actorId: session.userId,
    kind: "recusou_substituicao",
    eventId: eventId ?? null,
    teamId,
    meta: { swapId, requestedBy: swap.requested_by },
  });
  await notify({
    recipientId: swap.requested_by,
    kind: "troca_resolvida",
    title: `${quem} não vai poder cobrir`,
    body: "Sugira outra pessoa ou fale com o líder — a vaga continua sua até a troca ser aprovada.",
    link,
    teamId,
    eventId: eventId ?? null,
  });
  if (teamId) {
    await notifyMany(await teamLeaderIds(teamId), {
      kind: "troca_solicitada",
      title: "Substituto recusou",
      body: `${quem} não vai poder cobrir. A troca segue em aberto.`,
      link,
      teamId,
      eventId: eventId ?? null,
    });
  }

  revalidatePath("/inicio");
  if (eventId) revalidatePath(`/escalas/${eventId}`);
  return ok;
}

// =============================================================================
// CHAT INTERNO (avisos / equipe / evento) — texto puro
// =============================================================================

/** Título + url do push do canal (best-effort — busca o nome pelo channelRef). */
async function chatPushTitulo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  channelType: string,
  channelRef: string,
): Promise<{ title: string; url: string }> {
  if (channelType === "equipe") {
    const { data } = await supabase.from("teams").select("name").eq("id", channelRef).maybeSingle();
    return { title: `💬 ${data?.name ?? "Equipe"}`, url: "/inicio" };
  }
  if (channelType === "evento") {
    const { data } = await supabase.from("events").select("title").eq("id", channelRef).maybeSingle();
    return { title: `💬 ${data?.title ?? "Evento"}`, url: `/escalas/${channelRef}` };
  }
  // avisos (ou qualquer outro) → mural geral
  return { title: "📢 Avisos gerais", url: "/inicio" };
}

/** Envia uma mensagem no canal. A RLS bloqueia quem não pode postar (→ erro). */
export async function enviarMensagemChat(
  channelType: string,
  channelRef: string,
  body: string,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const churchId = session.profile.church_id;
  if (!churchId) return fail("Sessão sem igreja.");
  const texto = body.trim();
  if (!texto) return fail("Escreva uma mensagem.");

  const supabase = await createClient();
  const { error } = await supabase.from("chat_messages").insert({
    church_id: churchId,
    channel_type: channelType,
    channel_ref: channelRef,
    sender_id: session.userId,
    body: texto,
  });
  if (error) return fail(error.message);

  // Push pros membros do canal (menos autor / silenciados) — best-effort.
  try {
    const { data: subs } = await supabase.rpc("chat_push_recipients", {
      p_type: channelType,
      p_ref: channelRef,
    });
    if (subs && subs.length > 0) {
      const { title, url } = await chatPushTitulo(supabase, channelType, channelRef);
      await sendPushToSubs(subs, {
        title,
        body: texto.slice(0, 120),
        url,
        tag: `chat:${channelType}:${channelRef}`,
      });
    }
  } catch {
    /* push é bônus — nunca derruba o envio */
  }
  return ok;
}

/** Apaga uma mensagem do chat. A RLS (chat_messages_delete) só deixa o autor ou
 * um admin remover — aqui só chamamos; o banco é a fonte da verdade. */
export async function apagarMensagemChat(id: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const supabase = await createClient();
  const { error } = await supabase.from("chat_messages").delete().eq("id", id);
  if (error) return fail(error.message);
  return ok;
}

/** Liga/desliga o silêncio do canal (update-then-insert p/ não resetar leitura). */
export async function silenciarCanalChat(
  channelType: string,
  channelRef: string,
  muted: boolean,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const supabase = await createClient();
  const { data: updated } = await supabase
    .from("chat_reads")
    .update({ muted })
    .eq("profile_id", session.userId)
    .eq("channel_type", channelType)
    .eq("channel_ref", channelRef)
    .select("profile_id");
  if (!updated || updated.length === 0) {
    const { error } = await supabase.from("chat_reads").insert({
      profile_id: session.userId,
      channel_type: channelType,
      channel_ref: channelRef,
      muted,
    });
    if (error) return fail(error.message);
  }
  return ok;
}

/** Marca o canal como lido agora (update-then-insert p/ preservar `muted`). */
export async function marcarCanalLido(
  channelType: string,
  channelRef: string,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sessão expirada.");
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data: updated } = await supabase
    .from("chat_reads")
    .update({ last_read_at: now })
    .eq("profile_id", session.userId)
    .eq("channel_type", channelType)
    .eq("channel_ref", channelRef)
    .select("profile_id");
  if (!updated || updated.length === 0) {
    const { error } = await supabase.from("chat_reads").insert({
      profile_id: session.userId,
      channel_type: channelType,
      channel_ref: channelRef,
      last_read_at: now,
    });
    if (error) return fail(error.message);
  }
  return ok;
}
