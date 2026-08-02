"use client";

import { Conversation, canPostNoCanal } from "@/components/chat/chat-modal";
import type { CanalChat } from "@/lib/chat";

/**
 * Invólucro do chat na régia. Existe por uma razão de fronteira, não de visual:
 * a página /control é Server Component, e de lá não dá pra (a) chamar uma função
 * exportada de um módulo "use client" — o import vira uma referência, não a
 * função — nem (b) passar callback como prop pro cliente. Era isso que derrubava
 * a página com "server-side exception".
 *
 * Então o servidor manda só dados serializáveis (canal, id, papel) e a decisão de
 * permissão e o callback ficam deste lado.
 */
export function ControlChat({
  canal,
  meId,
  role,
}: {
  canal: CanalChat;
  meId: string;
  role: "admin" | "leader" | "volunteer";
}) {
  return (
    <Conversation
      channel={canal}
      meId={meId}
      canPost={canPostNoCanal(canal.type, role)}
      canDelete={role === "admin"}
      // silenciar canal é coisa do balão de chat; aqui não há onde mostrar
      onMuteChange={() => {}}
    />
  );
}
