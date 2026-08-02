"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Megaphone, Users, CalendarDays, Bell, BellOff, Send, Trash2 } from "lucide-react";
import { Modal } from "@/components/modal";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { enviarMensagemChat, silenciarCanalChat, apagarMensagemChat } from "@/lib/actions";
import { fmtTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useVisualViewport } from "@/lib/use-visual-viewport";
import type { CanalChat, ChatMessageView } from "@/lib/chat";

type Role = "admin" | "leader" | "volunteer";
type Tab = "geral" | "eventos" | "equipes";

/** Só admin posta em Avisos; nos demais canais quem enxerga o canal posta. */
export function canPostNoCanal(type: string, role: Role): boolean {
  if (type === "avisos") return role === "admin";
  return true;
}

const WD = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
/** Data curta pra sub-aba de evento (ex.: "dom 27/07"). */
function shortDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${WD[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function ChatModal({
  canais,
  meId,
  role,
  onOpenChannel,
  onClose,
  onMuteChange,
}: {
  canais: CanalChat[];
  meId: string;
  role: Role;
  onOpenChannel: (c: CanalChat) => void;
  onClose: () => void;
  onMuteChange: (type: string, ref: string, muted: boolean) => void;
}) {
  const avisos = useMemo(() => canais.find((c) => c.type === "avisos") ?? null, [canais]);
  const eventos = useMemo(() => canais.filter((c) => c.type === "evento"), [canais]);
  const equipes = useMemo(() => canais.filter((c) => c.type === "equipe"), [canais]);

  const [tab, setTab] = useState<Tab>("geral");
  const [eventoRef, setEventoRef] = useState<string | null>(null);
  const [equipeRef, setEquipeRef] = useState<string | null>(null);

  // Restaura a última posição (aba + sub-canal) do aparelho — comunicação ágil
  // durante o evento sem ficar reabrindo e reprocurando.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const raw = localStorage.getItem(`chat:pos:${meId}`);
      if (!raw) return;
      const p = JSON.parse(raw) as { tab?: Tab; eventoRef?: string; equipeRef?: string };
      if (p.tab === "geral" || p.tab === "eventos" || p.tab === "equipes") setTab(p.tab);
      if (p.eventoRef) setEventoRef(p.eventoRef);
      if (p.equipeRef) setEquipeRef(p.equipeRef);
    } catch {
      /* localStorage indisponível — segue no padrão */
    }
  }, [meId]);

  // Canal ativo derivado da aba + seleção (cai no 1º item se a seleção sumiu).
  const active: CanalChat | null = useMemo(() => {
    if (tab === "geral") return avisos;
    if (tab === "eventos") return eventos.find((c) => c.ref === eventoRef) ?? eventos[0] ?? null;
    return equipes.find((c) => c.ref === equipeRef) ?? equipes[0] ?? null;
  }, [tab, eventoRef, equipeRef, avisos, eventos, equipes]);

  // Reporta o canal ativo (marca lido / zera badge / suprime o realtime dele) e
  // salva a posição.
  useEffect(() => {
    if (active) onOpenChannel(active);
    try {
      localStorage.setItem(
        `chat:pos:${meId}`,
        JSON.stringify({
          tab,
          eventoRef: active?.type === "evento" ? active.ref : eventoRef,
          equipeRef: active?.type === "equipe" ? active.ref : equipeRef,
        }),
      );
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.type, active?.ref, tab]);

  const geralUnread = avisos?.unread ?? 0;
  const eventosUnread = eventos.reduce((s, c) => s + c.unread, 0);
  const equipesUnread = equipes.reduce((s, c) => s + c.unread, 0);

  // Teclado virtual (iOS): sobe o sheet e encaixa a altura na área visível.
  const { keyboard, viewportHeight } = useVisualViewport();
  const kbOpen = keyboard > 0 && viewportHeight != null;

  return (
    <Modal open onClose={onClose} sheet liftY={keyboard}>
      <div
        className="-mt-1 flex h-[80dvh] flex-col"
        style={kbOpen ? { height: `calc(${viewportHeight}px - 56px)` } : undefined}
      >
        <h3 className="mb-2 font-display text-[22px] font-extrabold leading-tight text-foreground">Conversas</h3>

        {/* Abas fixas de topo */}
        <div className="flex gap-1 rounded-2xl bg-muted/60 p-1">
          <TabButton active={tab === "geral"} onClick={() => setTab("geral")} Icon={Megaphone} label="Geral" badge={geralUnread} />
          <TabButton active={tab === "eventos"} onClick={() => setTab("eventos")} Icon={CalendarDays} label="Eventos" badge={eventosUnread} />
          <TabButton active={tab === "equipes"} onClick={() => setTab("equipes")} Icon={Users} label="Equipes" badge={equipesUnread} />
        </div>

        {/* Sub-abas roláveis (horizontais) */}
        {tab === "eventos" && eventos.length > 0 ? (
          <SubStrip items={eventos} activeRef={active?.ref ?? null} onSelect={setEventoRef} kind="evento" />
        ) : null}
        {tab === "equipes" && equipes.length > 0 ? (
          <SubStrip items={equipes} activeRef={active?.ref ?? null} onSelect={setEquipeRef} kind="equipe" />
        ) : null}

        {/* Conversa ativa (remonta ao trocar de canal) */}
        <div className="mt-2 flex min-h-0 flex-1 flex-col">
          {active ? (
            <Conversation
              key={`${active.type}:${active.ref}`}
              channel={active}
              meId={meId}
              canPost={canPostNoCanal(active.type, role)}
              canDelete={role === "admin"}
              onMuteChange={onMuteChange}
            />
          ) : (
            <EmptyTab tab={tab} />
          )}
        </div>
      </div>
    </Modal>
  );
}

function TabButton({
  active,
  onClick,
  Icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  Icon: typeof Megaphone;
  label: string;
  badge: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "press-sm relative flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[13px] font-bold",
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
      )}
    >
      <Icon className="size-4" />
      {label}
      {badge > 0 ? (
        <span className="grid min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-extrabold text-primary-foreground">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </button>
  );
}

function SubStrip({
  items,
  activeRef,
  onSelect,
  kind,
}: {
  items: CanalChat[];
  activeRef: string | null;
  onSelect: (ref: string) => void;
  kind: "evento" | "equipe";
}) {
  return (
    <div className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((c) => {
        const on = c.ref === activeRef;
        return (
          <button
            key={c.ref}
            onClick={() => onSelect(c.ref)}
            className={cn(
              "press-sm flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold",
              on ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground",
              kind === "evento" && c.past ? "opacity-55" : "",
            )}
            style={kind === "equipe" && c.color && !on ? { color: c.color } : undefined}
          >
            <span className="max-w-[9rem] truncate">{c.label}</span>
            {kind === "evento" && c.startsAt ? (
              <span className="text-[11px] font-medium opacity-70">{shortDate(c.startsAt)}</span>
            ) : null}
            {c.unread > 0 ? (
              <span className="grid min-w-[16px] place-items-center rounded-full bg-primary px-1 text-[10px] font-extrabold text-primary-foreground">
                {c.unread > 9 ? "9+" : c.unread}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function EmptyTab({ tab }: { tab: Tab }) {
  const msg =
    tab === "eventos"
      ? "Nenhum culto com conversa por aqui ainda."
      : tab === "equipes"
        ? "Você ainda não está em nenhuma equipe."
        : "Sem avisos por enquanto.";
  return <p className="grid flex-1 place-items-center px-6 text-center text-sm text-muted-foreground">{msg}</p>;
}

/** Painel de uma conversa. Exportado: a sala de controle (/control) reusa. */
export function Conversation({
  channel,
  meId,
  canPost,
  canDelete,
  onMuteChange,
}: {
  channel: CanalChat;
  meId: string;
  canPost: boolean;
  canDelete: boolean;
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
          let name = "Você";
          let avatar: string | null = null;
          if (m.sender_id !== meId) {
            const { data: p } = await supabase
              .from("profiles")
              .select("full_name, nickname, avatar_url")
              .eq("id", m.sender_id)
              .maybeSingle();
            const row = p as { nickname: string | null; full_name: string; avatar_url: string | null } | null;
            name = row?.nickname || row?.full_name || "Alguém";
            avatar = row?.avatar_url ?? null;
          }
          if (!alive) return;
          setMsgs((prev) =>
            prev.some((x) => x.id === m.id)
              ? prev
              : [
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
                ],
          );
          scrollToEnd();
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "chat_messages" },
        (payload) => {
          // O payload de DELETE só traz a PK (id). Remove por id se estiver na lista.
          const id = (payload.old as { id?: string })?.id;
          if (!id || !alive) return;
          setMsgs((prev) => prev.filter((x) => x.id !== id));
        },
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channelSub);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.type, channel.ref]);

  // Âncora no fim: toda mudança na lista termina mostrando a última mensagem.
  // (As chamadas pontuais não bastavam — em painel flex a altura assenta depois
  // do primeiro quadro e a rolagem parava no meio da conversa.)
  useEffect(() => {
    scrollToEnd();
    const t = window.setTimeout(scrollToEnd, 120); // 2ª passada: imagens/altura
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgs.length, loading]);

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

  const apagar = async (id: string) => {
    if (!window.confirm("Apagar esta mensagem para todos?")) return;
    const prev = msgs;
    setMsgs((cur) => cur.filter((x) => x.id !== id)); // otimista
    const r = await apagarMensagemChat(id);
    if (!r.ok) {
      setMsgs(prev); // desfaz
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
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Cabeçalho do canal */}
      <div className="mb-1 flex items-center gap-2 border-b border-border/70 pb-2">
        <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-foreground">{channel.label}</span>
        <button
          onClick={toggleMute}
          aria-label={muted ? "Reativar avisos" : "Silenciar"}
          className="press-sm grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground"
        >
          {muted ? <BellOff className="size-[18px]" /> : <Bell className="size-[18px]" />}
        </button>
      </div>

      {/* Mensagens */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-1 overflow-y-auto py-2">
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : msgs.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma mensagem ainda. Comece a conversa 💬</p>
        ) : (
          msgs.map((m, i) => {
            const prev = msgs[i - 1];
            // Agrupa: esconde nome/avatar quando é a mesma pessoa em sequência (< 5 min).
            const grouped =
              !!prev &&
              prev.senderId === m.senderId &&
              new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000;
            return <Bubble key={m.id} m={m} grouped={grouped} canDelete={canDelete} onDelete={apagar} />;
          })
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
            onFocus={() => {
              // Deixa o teclado/viewport assentarem antes de rolar pro fim.
              setTimeout(scrollToEnd, 300);
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
          Só a administração publica avisos aqui.
        </p>
      )}
    </div>
  );
}

function DeleteBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Apagar mensagem"
      className="press-sm grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground/60 hover:text-destructive-ink"
    >
      <Trash2 className="size-[15px]" />
    </button>
  );
}

function Bubble({
  m,
  grouped,
  canDelete,
  onDelete,
}: {
  m: ChatMessageView;
  grouped: boolean;
  canDelete: boolean;
  onDelete: (id: string) => void;
}) {
  const time = fmtTime(m.createdAt);
  if (m.mine) {
    return (
      <div className={cn("flex items-center justify-end gap-1", grouped ? "mt-0.5" : "mt-2")}>
        {canDelete ? <DeleteBtn onClick={() => onDelete(m.id)} /> : null}
        <div className="flex max-w-[80%] items-end gap-1.5 rounded-[16px] rounded-br-[5px] bg-primary px-3 py-1.5 text-[15px] leading-snug text-primary-foreground">
          <p className="min-w-0 whitespace-pre-wrap break-words">{m.body}</p>
          <span className="shrink-0 pb-0.5 text-[10px] leading-none opacity-70">{time}</span>
        </div>
      </div>
    );
  }
  return (
    <div className={cn("flex items-center gap-2", grouped ? "mt-0.5" : "mt-2")}>
      <span className="w-8 shrink-0 self-end">
        {grouped ? null : <Avatar name={m.senderName} src={m.senderAvatar} className="size-8" />}
      </span>
      <div className="max-w-[80%] rounded-[16px] rounded-bl-[5px] bg-muted px-3 py-1.5 text-[15px] leading-snug text-foreground">
        {grouped ? null : <p className="text-[11px] font-bold text-primary">{m.senderName}</p>}
        <div className="flex items-end gap-1.5">
          <p className="min-w-0 whitespace-pre-wrap break-words">{m.body}</p>
          <span className="shrink-0 pb-0.5 text-[10px] leading-none text-muted-foreground">{time}</span>
        </div>
      </div>
      {canDelete ? <DeleteBtn onClick={() => onDelete(m.id)} /> : null}
    </div>
  );
}
