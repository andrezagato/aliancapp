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

// Eventos a partir de ~12h atrás (mantém o culto do dia visível).
function eventCutoffIso(): string {
  return new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
}

/** Lista os canais do usuário com não-lidas, silêncio e último horário. */
export async function listarCanais(session: Session): Promise<CanalChat[]> {
  const churchId = session.profile.church_id;
  if (!churchId) return [];
  const supabase = await createClient();

  type Base = { type: ChatChannelType; ref: string; label: string; color?: string };
  const bases: Base[] = [{ type: "avisos", ref: churchId, label: "Avisos gerais" }];
  for (const t of session.profile.teams) {
    bases.push({ type: "equipe", ref: t.id, label: t.name, color: t.color });
  }

  // Eventos futuros/recentes em que estou escalado (event_id distinto, ~8).
  const { data: assigns } = await supabase
    .from("assignments")
    .select("event_id, events!inner ( id, title, starts_at, archived_at )")
    .eq("profile_id", session.userId)
    .neq("status", "recusado")
    .limit(100);
  const cutoff = eventCutoffIso();
  type Ev = { id: string; title: string; starts_at: string; archived_at: string | null };
  const seen = new Set<string>();
  const eventos = ((assigns ?? []) as { event_id: string; events: Ev | null }[])
    .map((r) => r.events)
    .filter((e): e is Ev => !!e && !e.archived_at && e.starts_at >= cutoff)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
    .slice(0, 8);
  for (const e of eventos) bases.push({ type: "evento", ref: e.id, label: e.title });

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
    return { type: b.type, ref: b.ref, label: b.label, color: b.color, unread, muted: read?.muted ?? false, lastAt };
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
