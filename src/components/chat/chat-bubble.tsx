"use client";

import { useEffect, useState } from "react";
import { MessagesSquare } from "lucide-react";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { marcarCanalLido } from "@/lib/actions";
import { ChatModal } from "@/components/chat/chat-modal";
import type { CanalChat } from "@/lib/chat";

type Role = "admin" | "leader" | "volunteer";

/**
 * Balão flutuante do chat interno (canto inferior direito, acima da bottom-nav).
 * Recebe os canais iniciais do servidor e assina o Realtime de `chat_messages`
 * pra manter o badge de não-lidas vivo — ignora as mensagens da própria pessoa
 * e o canal aberto no momento.
 */
export function ChatBubble({
  canais: inicial,
  meId,
  role,
}: {
  canais: CanalChat[];
  meId: string;
  role: Role;
}) {
  const [open, setOpen] = useState(false);
  const [canais, setCanais] = useState<CanalChat[]>(inicial);
  const [active, setActive] = useState<CanalChat | null>(null);

  const total = canais.reduce((s, c) => s + c.unread, 0);

  // Realtime global: incrementa o badge quando chega mensagem de outro canal.
  useEffect(() => {
    if (!supabaseConfigured) return;
    const supabase = createClient();
    const sub = supabase
      .channel("chat-bubble")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const m = payload.new as {
            sender_id: string;
            channel_type: string;
            channel_ref: string;
            created_at: string;
          };
          if (m.sender_id === meId) return;
          setCanais((prev) =>
            prev.map((c) => {
              if (c.type !== m.channel_type || c.ref !== m.channel_ref) return c;
              const viewing = open && active?.type === c.type && active?.ref === c.ref;
              return { ...c, lastAt: m.created_at, unread: viewing ? c.unread : c.unread + 1 };
            }),
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, [meId, open, active]);

  const openChannel = (c: CanalChat) => {
    setActive(c);
    // Zera o badge do canal localmente e marca lido no servidor (best-effort).
    setCanais((prev) => prev.map((x) => (x.type === c.type && x.ref === c.ref ? { ...x, unread: 0 } : x)));
    void marcarCanalLido(c.type, c.ref);
  };

  const onMuteChange = (type: string, ref: string, muted: boolean) => {
    setCanais((prev) => prev.map((c) => (c.type === type && c.ref === ref ? { ...c, muted } : c)));
    setActive((a) => (a && a.type === type && a.ref === ref ? { ...a, muted } : a));
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={total > 0 ? `Chat (${total} não lidas)` : "Chat"}
        className="press fixed right-4 z-40 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lift"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.75rem)" }}
      >
        <MessagesSquare className="size-6" />
        {total > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-[20px] place-items-center rounded-full border-2 border-background bg-destructive px-1 text-[10px] font-extrabold text-white">
            {total > 9 ? "9+" : total}
          </span>
        ) : null}
      </button>

      {open ? (
        <ChatModal
          canais={canais}
          meId={meId}
          role={role}
          onOpenChannel={openChannel}
          onClose={() => {
            setOpen(false);
            setActive(null);
          }}
          onMuteChange={onMuteChange}
        />
      ) : null}
    </>
  );
}
