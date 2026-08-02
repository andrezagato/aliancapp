"use client";

import { useState } from "react";
import { Conversation, canPostNoCanal } from "@/components/chat/chat-modal";
import { cn } from "@/lib/utils";
import type { CanalChat } from "@/lib/chat";

/**
 * Chat da régia: uma tira de canais + a conversa aberta.
 *
 * Diferente do balão do celular, que tem 3 abas (Geral/Eventos/Equipes) porque a
 * tela é estreita, aqui cabe tudo numa linha só — na régia o operador precisa
 * pular de "Produção" pra "Louvor" e voltar pro culto sem navegar em dois
 * níveis. Abre no canal do CULTO, que é a conversa da operação.
 *
 * Também existe por uma razão de fronteira: /control é Server Component, e de lá
 * não dá pra chamar função de módulo "use client" nem passar callback como prop
 * — era isso que derrubava a página. O servidor manda só dados; decisão de
 * permissão e callbacks moram aqui.
 */
export function ControlChat({
  canais,
  eventoId,
  meId,
  role,
}: {
  canais: CanalChat[];
  eventoId: string;
  meId: string;
  role: "admin" | "leader" | "volunteer";
}) {
  // canal do culto primeiro — é o que a régia usa o tempo todo
  const inicial =
    canais.find((c) => c.type === "evento" && c.ref === eventoId) ?? canais[0] ?? null;
  const [ativo, setAtivo] = useState<CanalChat | null>(inicial);

  if (!ativo) {
    return (
      <p className="grid flex-1 place-items-center px-6 text-center text-sm text-muted-foreground">
        Nenhum canal de chat disponível.
      </p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="-mx-1 mb-1 flex shrink-0 gap-1.5 overflow-x-auto px-1 pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {canais.map((c) => {
          const on = c.type === ativo.type && c.ref === ativo.ref;
          const doCulto = c.type === "evento" && c.ref === eventoId;
          return (
            <button
              key={`${c.type}:${c.ref}`}
              onClick={() => setAtivo(c)}
              className={cn(
                "press-sm flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold",
                on ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground",
                c.type === "evento" && c.past ? "opacity-55" : "",
              )}
              style={c.type === "equipe" && c.color && !on ? { color: c.color } : undefined}
            >
              {c.type === "equipe" && c.color ? (
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: c.color }} aria-hidden />
              ) : null}
              <span className="max-w-[10rem] truncate">{doCulto ? "Este culto" : c.label}</span>
              {c.unread > 0 && !on ? (
                <span className="grid min-w-[16px] place-items-center rounded-full bg-primary px-1 text-[11px] font-extrabold text-primary-foreground">
                  {c.unread > 9 ? "9+" : c.unread}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* key: trocar de canal remonta a conversa (zera mensagens e o realtime do
          canal anterior) em vez de misturar históricos */}
      <Conversation
        key={`${ativo.type}:${ativo.ref}`}
        channel={ativo}
        meId={meId}
        canPost={canPostNoCanal(ativo.type, role)}
        canDelete={role === "admin"}
        onMuteChange={() => {}}
      />
    </div>
  );
}
