"use client";

import { useState } from "react";
import { MessagesSquare } from "lucide-react";
import { marcarCanalLido } from "@/lib/actions";
import { ChatModal } from "@/components/chat/chat-modal";
import { useAlertaDeMensagens } from "@/components/chat/chat-alerta";
import { useSomDeAlerta, VOL_CELULAR } from "@/lib/alerta";
import type { CanalChat } from "@/lib/chat";

type Role = "admin" | "leader" | "volunteer";

/**
 * Balão flutuante do chat interno (canto inferior direito, acima da bottom-nav).
 * Recebe os canais iniciais do servidor e vive de Realtime pra manter o badge de
 * não-lidas vivo — ignora as mensagens da própria pessoa e o canal aberto.
 *
 * A vigilância do Realtime mudou de casa: agora é `useAlertaDeMensagens`, o mesmo
 * hook da régia. Aqui ele também toca (baixinho) e trema o aparelho — a diferença
 * é que o celular respeita o canal ABERTO na tela: apitar enquanto a pessoa lê a
 * conversa seria avisar de algo que ela está vendo. Na régia não, e de propósito
 * (ver a nota lá).
 *
 * App fechado continua com o push (VAPID) que já existia. Este alerta é pra
 * quando o app está na mão — o caso em que o push some no meio das notificações
 * do sistema e ninguém vê.
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

  const som = useSomDeAlerta(VOL_CELULAR);
  const { novas, reconhecer } = useAlertaDeMensagens({
    canais,
    meId,
    volume: VOL_CELULAR,
    somLigado: som.ligado,
    comVibracao: true,
    lendoAgora: (tipo, ref) => open && active?.type === tipo && active?.ref === ref,
    aoChegar: (m) =>
      setCanais((prev) =>
        prev.map((c) =>
          c.type === m.tipo && c.ref === m.ref
            ? { ...c, lastAt: m.criadaEm, unread: c.unread + 1 }
            : c,
        ),
      ),
  });

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
        onClick={() => {
          setOpen(true);
          reconhecer();
        }}
        aria-label={total > 0 ? `Chat (${total} não lidas)` : "Chat"}
        className="press fixed right-4 z-40 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lift"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.75rem)" }}
      >
        {/* Anel batendo enquanto há mensagem não reconhecida. É o par visual do
            apito: som sozinho falha no silencioso, no bolso e no barulho. */}
        {novas.length > 0 && !open ? (
          <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-primary/40" />
        ) : null}
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
          som={som}
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
