"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Megaphone, Users, CalendarDays, Bell, BellOff, Send } from "lucide-react";
import { Modal } from "@/components/modal";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { enviarMensagemChat, silenciarCanalChat } from "@/lib/actions";
import { fmtTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CanalChat, ChatMessageView } from "@/lib/chat";

type Role = "admin" | "leader" | "volunteer";

/** Ícone/cor de cada canal. */
function ChannelIcon({ c, className }: { c: CanalChat; className?: string }) {
  const Icon = c.type === "avisos" ? Megaphone : c.type === "evento" ? CalendarDays : Users;
  return (
    <span
      className={cn("grid size-10 shrink-0 place-items-center rounded-full", className)}
      style={c.type === "equipe" && c.color ? { backgroundColor: `${c.color}22`, color: c.color } : undefined}
    >
      <Icon className="size-[19px]" />
    </span>
  );
}

/** Só admin/líder posta em Avisos; nos demais canais quem é membro posta. */
function canPost(type: string, role: Role): boolean {
  if (type === "avisos") return role === "admin" || role === "leader";
  return true;
}

/** Horário curto pro preview da lista (HH:mm). */
function shortWhen(iso: string | null): string {
  return iso ? fmtTime(iso) : "";
}

export function ChatModal({
  canais,
  meId,
  role,
  active,
  onOpenChannel,
  onBack,
  onClose,
  onMuteChange,
}: {
  canais: CanalChat[];
  meId: string;
  role: Role;
  active: CanalChat | null;
  onOpenChannel: (c: CanalChat) => void;
  onBack: () => void;
  onClose: () => void;
  onMuteChange: (type: string, ref: string, muted: boolean) => void;
}) {
  return (
    <Modal open onClose={onClose} sheet>
      {active ? (
        <Conversation
          channel={active}
          meId={meId}
          canPost={canPost(active.type, role)}
          onBack={onBack}
          onMuteChange={onMuteChange}
        />
      ) : (
        <ChannelList canais={canais} onOpenChannel={onOpenChannel} />
      )}
    </Modal>
  );
}

function ChannelList({
  canais,
  onOpenChannel,
}: {
  canais: CanalChat[];
  onOpenChannel: (c: CanalChat) => void;
}) {
  return (
    <div className="-mt-1">
      <h3 className="mb-2 font-display text-[22px] font-extrabold leading-tight text-foreground">Conversas</h3>
      <ul className="-mx-1 max-h-[70dvh] space-y-0.5 overflow-y-auto">
        {canais.map((c) => (
          <li key={`${c.type}:${c.ref}`}>
            <button
              onClick={() => onOpenChannel(c)}
              className="press-sm flex w-full items-center gap-3 rounded-2xl px-1.5 py-2 text-left"
            >
              <ChannelIcon c={c} className="bg-primary/10 text-primary" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[15px] font-bold text-foreground">{c.label}</span>
                  {c.muted ? <BellOff className="size-3.5 shrink-0 text-muted-foreground" /> : null}
                </span>
                <span className="block truncate text-[13px] text-muted-foreground">
                  {c.lastAt ? `Última mensagem · ${shortWhen(c.lastAt)}` : "Nenhuma mensagem ainda"}
                </span>
              </span>
              {c.unread > 0 ? (
                <span className="grid min-w-[20px] shrink-0 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-extrabold text-primary-foreground">
                  {c.unread > 9 ? "9+" : c.unread}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Conversation({
  channel,
  meId,
  canPost,
  onBack,
  onMuteChange,
}: {
  channel: CanalChat;
  meId: string;
  canPost: boolean;
  onBack: () => void;
  onMuteChange: (type: string, ref: string, muted: boolean) => void;
}) {
  const { showToast } = useToast();
  const [msgs, setMsgs] = useState<ChatMessageView[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [muted, setMuted] = useState(channel.muted);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const scrollToEnd = () => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  // Carrega o histórico + assina o Realtime do canal (append das novas).
  useEffect(() => {
    const supabase = createClient();
    let alive = true;

    async function load() {
      const { data: rows } = await supabase
        .from("chat_messages")
        .select("id, body, sender_id, created_at")
        .eq("channel_type", channel.type)
        .eq("channel_ref", channel.ref)
        .order("created_at", { ascending: false })
        .limit(50);
      const list = (rows ?? []) as { id: string; body: string; sender_id: string; created_at: string }[];
      const senderIds = [...new Set(list.map((r) => r.sender_id))];
      const pmap = new Map<string, { name: string; avatar: string | null }>();
      if (senderIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, nickname, avatar_url")
          .in("id", senderIds);
        for (const p of (profs ?? []) as {
          id: string;
          full_name: string;
          nickname: string | null;
          avatar_url: string | null;
        }[]) {
          pmap.set(p.id, { name: p.nickname || p.full_name || "Alguém", avatar: p.avatar_url });
        }
      }
      const view: ChatMessageView[] = list
        .slice()
        .reverse()
        .map((m) => ({
          id: m.id,
          body: m.body,
          senderId: m.sender_id,
          senderName: pmap.get(m.sender_id)?.name ?? "Alguém",
          senderAvatar: pmap.get(m.sender_id)?.avatar ?? null,
          createdAt: m.created_at,
          mine: m.sender_id === meId,
        }));
      if (!alive) return;
      setMsgs(view);
      setLoading(false);
      scrollToEnd();
    }
    load();

    const channelSub = supabase
      .channel(`chat:${channel.type}:${channel.ref}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        async (payload) => {
          const m = payload.new as {
            id: string;
            body: string;
            sender_id: string;
            created_at: string;
            channel_type: string;
            channel_ref: string;
          };
          if (m.channel_type !== channel.type || m.channel_ref !== channel.ref) return;
          // Resolve nome/avatar do autor (leve — 1 msg por vez).
          let name = "Alguém";
          let avatar: string | null = null;
          if (m.sender_id === meId) {
            name = "Você";
          } else {
            const { data: p } = await supabase
              .from("profiles")
              .select("full_name, nickname, avatar_url")
              .eq("id", m.sender_id)
              .maybeSingle();
            if (p) {
              name = (p as { nickname: string | null; full_name: string }).nickname ||
                (p as { full_name: string }).full_name || "Alguém";
              avatar = (p as { avatar_url: string | null }).avatar_url;
            }
          }
          if (!alive) return;
          setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [
            ...prev,
            {
              id: m.id,
              body: m.body,
              senderId: m.sender_id,
              senderName: name,
              senderAvatar: avatar,
              createdAt: m.created_at,
              mine: m.sender_id === meId,
            },
          ]));
          scrollToEnd();
        },
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channelSub);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.type, channel.ref]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const r = await enviarMensagemChat(channel.type, channel.ref, body);
    setSending(false);
    if (r.ok) {
      setText("");
      scrollToEnd(); // a mensagem volta pelo Realtime
    } else {
      showToast(r.error);
    }
  };

  const toggleMute = async () => {
    const next = !muted;
    setMuted(next);
    onMuteChange(channel.type, channel.ref, next);
    const r = await silenciarCanalChat(channel.type, channel.ref, next);
    if (!r.ok) {
      setMuted(!next);
      onMuteChange(channel.type, channel.ref, !next);
      showToast(r.error);
    }
  };

  return (
    <div className="-mt-1 flex max-h-[74dvh] flex-col">
      {/* Header do canal */}
      <div className="mb-2 flex items-center gap-2 pr-8">
        <button onClick={onBack} aria-label="Voltar" className="press-sm -ml-1 grid size-9 place-items-center rounded-full text-foreground">
          <ChevronLeft className="size-6" />
        </button>
        <ChannelIcon c={channel} className="bg-primary/10 text-primary" />
        <span className="min-w-0 flex-1 truncate font-display text-[19px] font-extrabold leading-tight text-foreground">
          {channel.label}
        </span>
        <button
          onClick={toggleMute}
          aria-label={muted ? "Reativar avisos" : "Silenciar"}
          className="press-sm grid size-9 place-items-center rounded-full text-muted-foreground"
        >
          {muted ? <BellOff className="size-5" /> : <Bell className="size-5" />}
        </button>
      </div>

      {/* Mensagens */}
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto py-2">
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : msgs.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma mensagem ainda. Comece a conversa 💬</p>
        ) : (
          msgs.map((m) => <Bubble key={m.id} m={m} />)
        )}
      </div>

      {/* Composer */}
      {canPost ? (
        <div className="mt-1 flex items-end gap-2 border-t border-border/70 pt-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="Escreva uma mensagem…"
            className="max-h-28 min-h-[44px] flex-1 resize-none rounded-[16px] border border-border bg-card px-3.5 py-2.5 text-[15px] outline-none focus:border-primary"
          />
          <button
            onClick={send}
            disabled={sending || !text.trim()}
            aria-label="Enviar"
            className="press grid size-[44px] shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
          >
            <Send className="size-5" />
          </button>
        </div>
      ) : (
        <p className="mt-1 border-t border-border/70 pt-3 text-center text-[13px] text-muted-foreground">
          Só a liderança publica avisos aqui.
        </p>
      )}
    </div>
  );
}

function Bubble({ m }: { m: ChatMessageView }) {
  if (m.mine) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[78%] rounded-[16px] rounded-br-[5px] bg-primary px-3.5 py-2 text-[15px] leading-snug text-primary-foreground">
          <p className="whitespace-pre-wrap break-words">{m.body}</p>
          <p className="mt-0.5 text-right text-[10px] opacity-70">{fmtTime(m.createdAt)}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-end gap-2">
      <Avatar name={m.senderName} src={m.senderAvatar} className="size-8" />
      <div className="max-w-[78%] rounded-[16px] rounded-bl-[5px] bg-muted px-3.5 py-2 text-[15px] leading-snug text-foreground">
        <p className="text-[11px] font-bold text-primary">{m.senderName}</p>
        <p className="whitespace-pre-wrap break-words">{m.body}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">{fmtTime(m.createdAt)}</p>
      </div>
    </div>
  );
}
