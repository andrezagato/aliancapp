import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Session } from "@/lib/auth";

/**
 * Camada de leitura do chat interno (avisos / equipe / evento). Módulo de
 * servidor (sem "use server") — chamado por Server Components. A RLS já filtra
 * o que cada pessoa pode ver; aqui só montamos os canais e contamos não-lidas.
 */

export type ChatChannelType = "avisos" | "equipe" | "evento";

export type CanalChat = {
  type: ChatChannelType;
  ref: string;
  label: string;
  color?: string;
  unread: number;
  muted: boolean;
  lastAt: string | null;
  startsAt?: string | null; // evento: início (rótulo/ordenação)
  past?: boolean; // evento no passado recente (últimos 7 dias)
};

export type ChatMessageView = {
  id: string;
  body: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  createdAt: string;
  mine: boolean;
};

/** Lista os canais do usuário com não-lidas, silêncio e último horário. */
export async function listarCanais(session: Session): Promise<CanalChat[]> {
  const churchId = session.profile.church_id;
  if (!churchId) return [];
  const supabase = await createClient();

  type Base = {
    type: ChatChannelType;
    ref: string;
    label: string;
    color?: string;
    startsAt?: string | null;
    past?: boolean;
  };
  const bases: Base[] = [{ type: "avisos", ref: churchId, label: "Avisos gerais" }];
  for (const t of session.profile.teams) {
    bases.push({ type: "equipe", ref: t.id, label: t.name, color: t.color });
  }

  // Eventos onde estou ESCALADO ou LIDERO uma equipe do evento; janela = futuros
  // + últimos 7 dias (a RLS do canal 'evento', migration 0037, usa a mesma regra).
  const leadIds = session.profile.teams.filter((t) => t.role === "leader").map((t) => t.id);
  const windowStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const nowMinus12h = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  type Ev = { id: string; title: string; starts_at: string; archived_at: string | null };

  const [assignsRes, ledRes] = await Promise.all([
    supabase
      .from("assignments")
      .select("events!inner ( id, title, starts_at, archived_at )")
      .eq("profile_id", session.userId)
      .neq("status", "recusado")
      .gte("events.starts_at", windowStart)
      .limit(200),
    leadIds.length
      ? supabase
          .from("event_requirements")
          .select("events!inner ( id, title, starts_at, archived_at )")
          .in("team_id", leadIds)
          .gte("events.starts_at", windowStart)
          .limit(200)
      : Promise.resolve({ data: [] as { events: Ev | null }[] }),
  ]);

  const evMap = new Map<string, Ev>();
  for (const r of [
    ...((assignsRes.data ?? []) as { events: Ev | null }[]),
    ...((ledRes.data ?? []) as { events: Ev | null }[]),
  ]) {
    const e = r.events;
    if (e && !e.archived_at && !evMap.has(e.id)) evMap.set(e.id, e);
  }

  const eventos = [...evMap.values()].sort((a, b) => {
    const ap = a.starts_at < nowMinus12h;
    const bp = b.starts_at < nowMinus12h;
    if (ap !== bp) return ap ? 1 : -1; // não-passados primeiro
    return ap
      ? b.starts_at.localeCompare(a.starts_at) // passados: mais recente primeiro
      : a.starts_at.localeCompare(b.starts_at); // futuros: mais próximo primeiro
  });
  for (const e of eventos) {
    bases.push({
      type: "evento",
      ref: e.id,
      label: e.title,
      startsAt: e.starts_at,
      past: e.starts_at < nowMinus12h,
    });
  }

  const refs = bases.map((b) => b.ref);

  // reads do usuário + mensagens dos canais (duas queries, sem N+1).
  const [{ data: reads }, { data: msgs }] = await Promise.all([
    supabase
      .from("chat_reads")
      .select("channel_type, channel_ref, last_read_at, muted")
      .eq("profile_id", session.userId),
    supabase
      .from("chat_messages")
      .select("channel_type, channel_ref, created_at, sender_id")
      .in("channel_ref", refs)
      .order("created_at", { ascending: false }),
  ]);

  const readMap = new Map<string, { last_read_at: string; muted: boolean }>();
  for (const r of (reads ?? []) as {
    channel_type: string;
    channel_ref: string;
    last_read_at: string;
    muted: boolean;
  }[]) {
    readMap.set(`${r.channel_type}:${r.channel_ref}`, { last_read_at: r.last_read_at, muted: r.muted });
  }

  const rows = (msgs ?? []) as {
    channel_type: string;
    channel_ref: string;
    created_at: string;
    sender_id: string;
  }[];

  return bases.map((b) => {
    const key = `${b.type}:${b.ref}`;
    const read = readMap.get(key);
    let lastAt: string | null = null;
    let unread = 0;
    for (const m of rows) {
      if (m.channel_type !== b.type || m.channel_ref !== b.ref) continue;
      if (!lastAt) lastAt = m.created_at; // rows vêm desc → o 1º é o mais recente
      if (m.sender_id === session.userId) continue;
      if (!read || m.created_at > read.last_read_at) unread++;
    }
    return {
      type: b.type,
      ref: b.ref,
      label: b.label,
      color: b.color,
      unread,
      muted: read?.muted ?? false,
      lastAt,
      startsAt: b.startsAt ?? null,
      past: b.past ?? false,
    };
  });
}

/** Últimas mensagens do canal (asc no fim), com nome/avatar do autor. */
export async function listarMensagens(
  channelType: string,
  channelRef: string,
  limit = 50,
): Promise<ChatMessageView[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user?.id ?? null;

  const { data: msgs } = await supabase
    .from("chat_messages")
    .select("id, body, sender_id, created_at")
    .eq("channel_type", channelType)
    .eq("channel_ref", channelRef)
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows = (msgs ?? []) as { id: string; body: string; sender_id: string; created_at: string }[];
  if (rows.length === 0) return [];

  const senderIds = [...new Set(rows.map((r) => r.sender_id))];
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, full_name, nickname, avatar_url")
    .in("id", senderIds);
  const pmap = new Map<string, { full_name: string; nickname: string | null; avatar_url: string | null }>();
  for (const p of (profs ?? []) as {
    id: string;
    full_name: string;
    nickname: string | null;
    avatar_url: string | null;
  }[]) {
    pmap.set(p.id, { full_name: p.full_name, nickname: p.nickname, avatar_url: p.avatar_url });
  }

  // Inverte: mais antigas em cima, mais recentes embaixo.
  return rows
    .slice()
    .reverse()
    .map((m) => {
      const p = pmap.get(m.sender_id);
      return {
        id: m.id,
        body: m.body,
        senderId: m.sender_id,
        senderName: p?.nickname || p?.full_name || "Alguém",
        senderAvatar: p?.avatar_url ?? null,
        createdAt: m.created_at,
        mine: m.sender_id === uid,
      };
    });
}
